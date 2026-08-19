const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");
const ubi = document.getElementById("ubi");

let latitud;
let longitud;

const canvas = document.getElementById("cielo");
const ctx = canvas.getContext("2d");

let estrellas = [];


// =====================================================
// TEXTO INICIAL
// =====================================================

const texto = "Tu ubicación es";
let i = 0;

function escribir() {

    if (i < texto.length) {

        texto1.textContent += texto[i];

        i++;

        setTimeout(escribir, 100);

    } else {

        obtenerUbicacion();

    }
}


// =====================================================
// UBICACIÓN
// =====================================================

async function obtenerUbicacion() {

    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {

            latitud = coords.latitude;
            longitud = coords.longitude;

            console.log("📍 Latitud:", latitud);
            console.log("📍 Longitud:", longitud);


            const resultado = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
            );

            const informacion =
                await resultado.json();


            const {
                city,
                town,
                village,
                municipality,
                country
            } = informacion.address;


            const ciudad =
                city ||
                town ||
                village ||
                municipality;


            ubicacion.textContent =
                `${ciudad}, ${country}`;


            ubi.textContent =
                `${ciudad}, ${country}`;


            // =========================================
            // TU EFECTO ORIGINAL
            // =========================================

            setTimeout(() => {

                ubicacionDiv.remove();

            }, 3000);


            // Dibujar estrellas
            dibujarCielo();

        }
    );

}


// =====================================================
// CARGAR ESTRELLAS
// =====================================================

async function cargarEstrellas() {

    try {

        const respuesta =
            await fetch("datos/estrellas.json");


        estrellas =
            await respuesta.json();


        console.log(
            "⭐ Estrellas cargadas:",
            estrellas.length
        );


        dibujarCielo();


    } catch (error) {

        console.error(
            "❌ Error cargando estrellas.json:",
            error
        );

    }

}


// =====================================================
// CONVERTIR RA
//
// "21h 24m 09.6s"
// → horas decimales
// =====================================================

function convertirRA(raTexto) {

    const partes =
        raTexto.match(
            /(\d+(?:\.\d+)?)h\s*(\d+(?:\.\d+)?)m\s*(\d+(?:\.\d+)?)s/
        );


    if (!partes) {

        return null;

    }


    const horas =
        Number(partes[1]);


    const minutos =
        Number(partes[2]);


    const segundos =
        Number(partes[3]);


    return (
        horas +
        minutos / 60 +
        segundos / 3600
    );

}


// =====================================================
// CONVERTIR DEC
//
// "-20° 51′ 07″"
// → grados decimales
// =====================================================

function convertirDec(decTexto) {

    const partes =
        decTexto.match(
            /([+-])(\d+)°\s*(\d+)′\s*(\d+(?:\.\d+)?)″/
        );


    if (!partes) {

        return null;

    }


    const signo =
        partes[1] === "-"
            ? -1
            : 1;


    const grados =
        Number(partes[2]);


    const minutos =
        Number(partes[3]);


    const segundos =
        Number(partes[4]);


    return signo * (
        grados +
        minutos / 60 +
        segundos / 3600
    );

}


// =====================================================
// POSICIÓN DE UNA ESTRELLA
// =====================================================

function posicionEstrella(estrella) {

    if (
        latitud === undefined ||
        longitud === undefined
    ) {

        return null;

    }


    if (
        !estrella.RA ||
        !estrella.Dec
    ) {

        return null;

    }


    const raHoras =
        convertirRA(estrella.RA);


    const decGrados =
        convertirDec(estrella.Dec);


    if (
        raHoras === null ||
        decGrados === null
    ) {

        return null;

    }


    const fecha = new Date();


    // Tiempo sidéreo local
    const sidereal =
        Astronomy.SiderealTime(
            fecha,
            longitud
        );


    // RA → grados
    const raGrados =
        raHoras * 15;


    // Ángulo horario
    let anguloHora =
        sidereal * 15 -
        raGrados;


    while (anguloHora < -180) {

        anguloHora += 360;

    }


    while (anguloHora > 180) {

        anguloHora -= 360;

    }


    const latRad =
        latitud *
        Math.PI / 180;


    const decRad =
        decGrados *
        Math.PI / 180;


    const haRad =
        anguloHora *
        Math.PI / 180;


    // Altitud
    const sinAlt =
        Math.sin(latRad) *
        Math.sin(decRad) +

        Math.cos(latRad) *
        Math.cos(decRad) *
        Math.cos(haRad);


    const altRad =
        Math.asin(
            Math.max(
                -1,
                Math.min(
                    1,
                    sinAlt
                )
            )
        );


    const altitud =
        altRad *
        180 /
        Math.PI;


    // Azimut
    const azRad =
        Math.atan2(
            Math.sin(haRad),
            Math.cos(haRad) *
                Math.sin(latRad) -
            Math.tan(decRad) *
                Math.cos(latRad)
        );


    let azimut =
        azRad *
        180 /
        Math.PI +
        180;


    if (azimut < 0) {

        azimut += 360;

    }


    if (azimut >= 360) {

        azimut -= 360;

    }


    return {
        azimut,
        altitud
    };

}


// =====================================================
// DIBUJAR CIELO
// =====================================================

function dibujarCielo() {

    const ancho =
        window.innerWidth;


    const alto =
        window.innerHeight;


    // Fondo
    ctx.fillStyle =
        "#02030a";


    ctx.fillRect(
        0,
        0,
        ancho,
        alto
    );


    if (
        latitud === undefined ||
        estrellas.length === 0
    ) {

        return;

    }


    /*
     * DE MOMENTO dejamos el centro fijo.
     *
     * Esto es solamente para comprobar que
     * las estrellas se dibujan correctamente.
     *
     * Después conectaremos esto con el sensor
     * del móvil.
     */

    const centroAzimut = 180;
    const centroAltitud = 45;


    const campoHorizontal = 90;
    const campoVertical = 60;


    for (
        const estrella of estrellas
    ) {

        const posicion =
            posicionEstrella(
                estrella
            );


        if (!posicion) {

            continue;

        }


        // No dibujar estrellas bajo el horizonte
        if (
            posicion.altitud <= 0
        ) {

            continue;

        }


        // Diferencia de azimut
        let diferenciaAzimut =
            posicion.azimut -
            centroAzimut;


        while (
            diferenciaAzimut > 180
        ) {

            diferenciaAzimut -= 360;

        }


        while (
            diferenciaAzimut < -180
        ) {

            diferenciaAzimut += 360;

        }


        // Diferencia de altitud
        const diferenciaAltitud =
            posicion.altitud -
            centroAltitud;


        // Fuera de pantalla
        if (
            Math.abs(diferenciaAzimut) >
            campoHorizontal / 2
        ) {

            continue;

        }


        if (
            Math.abs(diferenciaAltitud) >
            campoVertical / 2
        ) {

            continue;

        }


        // X
        const x =
            ancho / 2 +
            (
                diferenciaAzimut /
                (campoHorizontal / 2)
            ) *
            (ancho / 2);


        // Y
        const y =
            alto / 2 -
            (
                diferenciaAltitud /
                (campoVertical / 2)
            ) *
            (alto / 2);


        // Magnitud
        const magnitud =
            Number(estrella.V);


        if (
            Number.isNaN(magnitud)
        ) {

            continue;

        }


        // Brillo
        const brillo =
            Math.max(
                0.5,
                Math.min(
                    5,
                    5 - magnitud
                )
            );


        const radio =
            0.7 +
            brillo * 0.35;


        const opacidad =
            Math.max(
                0.35,
                Math.min(
                    1,
                    1.15 -
                    magnitud / 7
                )
            );


        // Dibujar estrella
        ctx.beginPath();


        ctx.arc(
            x,
            y,
            radio,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            `rgba(255,255,255,${opacidad})`;


        ctx.fill();


        // Estrellas muy brillantes
        if (
            magnitud < 1.5
        ) {

            ctx.beginPath();


            ctx.arc(
                x,
                y,
                radio * 3,
                0,
                Math.PI * 2
            );


            const gradiente =
                ctx.createRadialGradient(
                    x,
                    y,
                    0,
                    x,
                    y,
                    radio * 3
                );


            gradiente.addColorStop(
                0,
                "rgba(255,255,255,0.3)"
            );


            gradiente.addColorStop(
                1,
                "rgba(255,255,255,0)"
            );


            ctx.fillStyle =
                gradiente;


            ctx.fill();

        }

    }

}


// =====================================================
// CÁMARA
// =====================================================

async function iniciarCamara() {

    try {

        const transmision =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {
                        facingMode: "environment"
                    }

                });


        const camara =
            document.getElementById(
                "camara"
            );


        camara.srcObject =
            transmision;


        console.log(
            "📷 Cámara activada"
        );


    } catch (error) {

        console.error(
            "❌ Error cámara:",
            error
        );

    }

}


// =====================================================
// INICIO
// =====================================================

escribir();

iniciarCamara();

cargarEstrellas();


// =====================================================
// SENSORES
// =====================================================

document
    .getElementById("activar")
    .addEventListener(
        "click",
        async () => {

            if (
                typeof DeviceOrientationEvent
                    .requestPermission ===
                "function"
            ) {

                const permiso =
                    await DeviceOrientationEvent
                        .requestPermission();


                if (
                    permiso !== "granted"
                ) {

                    return;

                }

            }


            let ultimaActualizacion = 0;


            window.addEventListener(
                "deviceorientation",
                (e) => {

                    const ahora =
                        Date.now();


                    if (
                        ahora -
                        ultimaActualizacion <
                        100
                    ) {

                        return;

                    }


                    ultimaActualizacion =
                        ahora;


                    document
                        .getElementById(
                            "direccion"
                        )
                        .textContent =
                        e.alpha?.toFixed(1)
                        + "°";


                    document
                        .getElementById(
                            "altitud"
                        )
                        .textContent =
                        e.beta?.toFixed(1)
                        + "°";

                }
            );

        }
    );


// =====================================================
// ACTUALIZAR CIELO
// =====================================================

setInterval(
    dibujarCielo,
    1000
);
