import {
    estado
} from "./state.js";

import {
    cargarDatosAstronomicos,
    calcularPlanetas,
    iniciarActualizacionPlanetas
} from "./astronomy.js";

import {
    solicitarPermisoSensores,
    activarSensores,
    calibrarSensores
} from "./sensors.js";

import {
    actualizarPantalla,
    ajustarCanvas,
    actualizarFOV
} from "./renderer.js";


const mensaje =
    document.getElementById(
        "ubicacionMensaje"
    );

const ubicacion =
    document.getElementById(
        "ubicacionUsuario"
    );

const pantallaInicio =
    document.getElementById(
        "ubicacionDiv"
    );

const botonSensores =
    document.getElementById(
        "activar"
    );

const botonCalibrar =
    document.getElementById(
        "calibrar"
    );

const botonModo =
    document.getElementById(
        "modoBoton"
    );

const botonBuscar =
    document.getElementById(
        "buscarObjeto"
    );

const sliderFov =
    document.getElementById(
        "fovSlider"
    );

const textoFov =
    document.getElementById(
        "fovValor"
    );


export async function conseguirUbicacion() {

    if (!navigator.geolocation) {

        ubicacion.textContent =
            "La ubicación no está disponible.";

        return;
    }

    navigator.geolocation.getCurrentPosition(

        async posicion => {

            estado.latitud =
                posicion.coords.latitude;

            estado.longitud =
                posicion.coords.longitude;


            ubicacion.textContent =
                await buscarCiudad(
                    estado.latitud,
                    estado.longitud
                );


            await cargarDatosAstronomicos();

            calcularPlanetas();

            iniciarActualizacionPlanetas(
                actualizarPantalla
            );

            actualizarPantalla();


            setTimeout(() => {

                pantallaInicio?.remove();

            }, 2500);
        },


        error => {

            mensaje.textContent =
                "No se pudo obtener tu ubicación";

            ubicacion.textContent =
                `Error ${error.code}: ${error.message}`;

            setTimeout(() => {

                pantallaInicio?.remove();

            }, 2500);
        },


        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}


async function buscarCiudad(
    lat,
    lon
) {

    try {

        const url =
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

        const respuesta =
            await fetch(url);

        if (!respuesta.ok) {
            throw new Error(
                "No se encontró la ciudad"
            );
        }

        const datos =
            await respuesta.json();

        const direccion =
            datos.address || {};

        const ciudad =
            direccion.city ||
            direccion.town ||
            direccion.village ||
            direccion.municipality ||
            direccion.county ||
            "Ubicación desconocida";

        return `${ciudad}, ${direccion.country || ""}`;

    } catch (error) {

        console.error(error);

        return "Ubicación obtenida";
    }
}


function cambiarModo() {

    estado.modo =
        estado.modo === "ar"
            ? "libre"
            : "ar";

    document.body.classList.toggle(
        "modo-libre",
        estado.modo === "libre"
    );

    botonModo.textContent =
        estado.modo === "ar"
            ? "Modo mapa libre"
            : "Modo cámara (AR)";

    actualizarPantalla();
}


function buscarObjeto() {

    if (!estado.planetas.length) {

        alert(
            "Todavía estoy calculando los objetos del cielo."
        );

        return;
    }

    const nombres =
        estado.planetas
            .map(
                planeta =>
                    planeta.nombre
            )
            .join("\n");

    const texto =
        prompt(
            `¿Qué quieres encontrar?\n\n${nombres}`
        );

    if (!texto) {
        return;
    }

    const buscado =
        texto
            .toLowerCase()
            .trim();

    const encontrado =
        estado.planetas.find(
            planeta =>
                planeta.nombre
                    .toLowerCase() ===
                buscado
        );

    if (!encontrado) {

        alert(
            "No encuentro ese objeto."
        );

        return;
    }

    estado.objetoBuscado = {
        ...encontrado
    };

    actualizarPantalla();
}


function configurarFOV() {

    if (!sliderFov) {
        return;
    }

    sliderFov.value =
        estado.campoVision;

    actualizarFOV();

    sliderFov.addEventListener(
        "input",
        () => {

            estado.campoVision =
                Number(
                    sliderFov.value
                );

            localStorage.setItem(
                "fovH",
                estado.campoVision
            );

            actualizarFOV();

            if (textoFov) {

                textoFov.textContent =
                    `${estado.campoVision}°`;
            }

            actualizarPantalla();
        }
    );

    if (textoFov) {

        textoFov.textContent =
            `${estado.campoVision}°`;
    }
}


function configurarMovimientoMapa() {

    const canvas =
        document.getElementById(
            "cieloCamara"
        );

    canvas.addEventListener(
        "pointerdown",
        evento => {

            if (
                estado.modo !== "libre"
            ) {
                return;
            }

            estado.moviendo = true;

            estado.inicioX =
                evento.clientX;

            estado.inicioY =
                evento.clientY;

            estado.inicioDireccion =
                estado.direccion;

            estado.inicioAltura =
                estado.altura;

            canvas.setPointerCapture?.(
                evento.pointerId
            );
        }
    );


    canvas.addEventListener(
        "pointermove",
        evento => {

            if (!estado.moviendo) {
                return;
            }

            const cambioX =
                evento.clientX -
                estado.inicioX;

            const cambioY =
                evento.clientY -
                estado.inicioY;


            estado.direccion =
                (
                    estado.inicioDireccion -
                    cambioX *
                    estado.campoVision /
                    innerWidth +
                    360
                ) % 360;


            estado.altura =
                Math.max(
                    -85,
                    Math.min(
                        85,

                        estado.inicioAltura -
                        cambioY *
                        estado.campoVisionVertical /
                        innerHeight
                    )
                );


            document.getElementById(
                "direccion"
            ).textContent =
                `${estado.direccion.toFixed(1)}°`;

            document.getElementById(
                "altitud"
            ).textContent =
                `${estado.altura.toFixed(1)}°`;

            actualizarPantalla();
        }
    );


    window.addEventListener(
        "pointerup",
        () => {
            estado.moviendo = false;
        }
    );
}


function mostrarInicio() {

    const texto =
        "Tu ubicación es";

    let posicion = 0;

    mensaje.textContent =
        "";

    const escribir =
        setInterval(
            () => {

                if (
                    posicion >=
                    texto.length
                ) {

                    clearInterval(
                        escribir
                    );

                    conseguirUbicacion();

                    return;
                }

                mensaje.textContent +=
                    texto[posicion];

                posicion++;

            },
            60
        );
}


export function configurarUI() {

    botonBuscar?.addEventListener(
        "click",
        buscarObjeto
    );


    botonCalibrar?.addEventListener(
        "click",
        calibrarSensores
    );


    botonModo?.addEventListener(
        "click",
        cambiarModo
    );


    botonSensores?.addEventListener(
        "click",
        async () => {

            try {

                const permitido =
                    await solicitarPermisoSensores();

                if (!permitido) {

                    document.getElementById(
                        "debug"
                    ).textContent =
                        "Permiso de sensores denegado.";

                    return;
                }

                activarSensores();

                botonSensores.textContent =
                    "Sensores activados";

            } catch (error) {

                console.error(error);

                document.getElementById(
                    "debug"
                ).textContent =
                    "No se pudieron activar los sensores.";
            }
        }
    );


    configurarFOV();

    configurarMovimientoMapa();

    window.addEventListener(
        "resize",
        ajustarCanvas
    );
}


export function iniciarPantalla() {
    mostrarInicio();
}
