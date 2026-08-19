const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");
const ubi = document.getElementById("ubi");
const canvas = document.getElementById("cielo");
const ctx = canvas.getContext("2d");
const direccionElemento = document.getElementById("direccion");
const altitudElemento = document.getElementById("altitud");

let latitud;
let longitud;

let estrellas = [];


// =====================================================
// ORIENTACIÓN DEL MÓVIL
// =====================================================

let heading = 0;
let pitch = 0;

const FOV_HORIZONTAL = 90;
const FOV_VERTICAL = 60;


// =====================================================
// EFECTO INICIAL
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
// OBTENER UBICACIÓN
// =====================================================

async function obtenerUbicacion() {

    navigator.geolocation.getCurrentPosition(

        async ({ coords }) => {

            latitud = coords.latitude;
            longitud = coords.longitude;

            console.log("Latitud:", latitud);
            console.log("Longitud:", longitud);

            try {

                const resultado = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json`
                );

                if (!resultado.ok) {
                    throw new Error(
                        `HTTP ${resultado.status}`
                    );
                }

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
                    municipality ||
                    "Ubicación desconocida";

                ubicacion.textContent =
                    `${ciudad}, ${country}`;

                ubi.textContent =
                    `${ciudad}, ${country}`;

            } catch (error) {

                console.error(
                    "Error obteniendo ciudad:",
                    error
                );

                ubicacion.textContent =
                    "Ubicación obtenida";

                ubi.textContent =
                    "Ubicación obtenida";
            }


            // =================================================
            // CARGAR ESTRELLAS
            // =================================================

            cargarEstrellas();


            // =================================================
            // ACTUALIZAR DÍA / NOCHE
            // =================================================

            actualizarCieloDiaNoche();


            // =================================================
            // QUITAR PANTALLA DE UBICACIÓN
            // DESPUÉS DE 3 SEGUNDOS
            // =================================================

            setTimeout(() => {

                if (ubicacionDiv) {
                    ubicacionDiv.remove();
                }

            }, 3000);

        },

        error => {

            console.error(
                "Error de ubicación:",
                error
            );

        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }

    );

}


// =====================================================
// CARGAR ESTRELLAS
// =====================================================

async function cargarEstrellas() {

    try {

        const respuesta =
            await fetch("estrellas.json");

        if (!respuesta.ok) {

            throw new Error(
                `HTTP ${respuesta.status}`
            );

        }

        estrellas =
            await respuesta.json();

        console.log(
            "⭐ Estrellas:",
            estrellas.length
        );

        redimensionarCanvas();

        dibujarCielo();

    } catch (error) {

        console.error(
            "Error cargando estrellas:",
            error
        );

    }

}


// =====================================================
// RA → GRADOS
// =====================================================

function raAGrados(ra) {

    if (!ra) {
        return null;
    }

    const partes = ra.match(
        /(\d+)h\s*(\d+)m\s*([\d.]+)s/
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
    ) * 15;

}


// =====================================================
// DEC → GRADOS
// =====================================================

function decAGrados(dec) {

    if (!dec) {
        return null;
    }

    let partes = dec.match(
        /([+-])(\d+)°\s*(\d+)′\s*(\d+(?:\.\d+)?)″/
    );

    if (!partes) {

        partes = dec.match(
            /([+-])(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/
        );

    }

    if (!partes) {
        return null;
    }

    const signo =
        partes[1] === "-" ? -1 : 1;

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
// TIEMPO SIDERAL
// =====================================================

function tiempoSideral() {

    if (
        latitud === undefined ||
        longitud === undefined
    ) {
        return 0;
    }

    const ahora = new Date();

    const jd =
        ahora.getTime() / 86400000 +
        2440587.5;

    const T =
        (jd - 2451545.0) / 36525;

    let gmst =
        280.46061837 +
        360.98564736629 *
        (jd - 2451545.0) +
        0.000387933 * T * T -
        T * T * T / 38710000;

    gmst =
        ((gmst % 360) + 360) % 360;

    return (
        (gmst + longitud) % 360 + 360
    ) % 360;

}


// =====================================================
// RA/DEC → ALTITUD/AZIMUT
// =====================================================

function estrellaAltAz(ra, dec) {

    const lst =
        tiempoSideral();

    let H =
        lst - ra;

    H =
        ((H + 180) % 360) - 180;

    const lat =
        latitud *
        Math.PI / 180;

    const decl =
        dec *
        Math.PI / 180;

    const hora =
        H *
        Math.PI / 180;


    // ALTITUD

    const sinAlt =
        Math.sin(lat) *
        Math.sin(decl) +

        Math.cos(lat) *
        Math.cos(decl) *
        Math.cos(hora);

    const alt =
        Math.asin(
            Math.max(
                -1,
                Math.min(1, sinAlt)
            )
        );


    // AZIMUT

    const az =
        Math.atan2(

            Math.sin(hora),

            Math.cos(hora) *
            Math.sin(lat) -

            Math.tan(decl) *
            Math.cos(lat)

        );

    let azDeg =
        az * 180 / Math.PI + 180;

    azDeg =
        ((azDeg % 360) + 360) % 360;


    return {

        azimut: azDeg,

        altitud:
            alt * 180 / Math.PI

    };

}


// =====================================================
// ACTIVAR SENSORES
// =====================================================

function activarSensores() {

    let ultimaActualizacion = 0;

    window.addEventListener(

        "deviceorientation",

        event => {

            const ahora =
                Date.now();

            if (
                ahora -
                ultimaActualizacion <
                50
            ) {
                return;
            }

            ultimaActualizacion =
                ahora;


            // =================================================
            // DIRECCIÓN
            // =================================================

            let nuevoHeading;


            // iPhone / iPad

            if (
                typeof event.webkitCompassHeading ===
                "number"
            ) {

                nuevoHeading =
                    event.webkitCompassHeading;

            }


            // Android / otros

            else if (
                typeof event.alpha ===
                "number"
            ) {

                nuevoHeading =
                    360 -
                    event.alpha;

            }


            if (
                typeof nuevoHeading ===
                "number" &&
                !Number.isNaN(nuevoHeading)
            ) {

                heading =
                    (
                        nuevoHeading +
                        360
                    ) % 360;

                direccionElemento.textContent =
                    heading.toFixed(1) +
                    "°";

            }


            // =================================================
            // INCLINACIÓN
            // =================================================

            if (
                typeof event.beta ===
                "number" &&
                !Number.isNaN(event.beta)
            ) {

                pitch =
                    event.beta;

                altitudElemento.textContent =
                    pitch.toFixed(1) +
                    "°";

            }


            dibujarCielo();

        },

        true

    );

}


// =====================================================
// BOTÓN DE SENSORES
// =====================================================

document
    .getElementById("activar")
    .addEventListener(
        "click",
        async () => {

            try {

                if (
                    typeof DeviceOrientationEvent !==
                    "undefined" &&

                    typeof DeviceOrientationEvent
                        .requestPermission ===
                    "function"
                ) {

                    const permiso =
                        await DeviceOrientationEvent
                            .requestPermission();

                    if (
                        permiso !==
                        "granted"
                    ) {

                        console.error(
                            "Permiso de orientación rechazado"
                        );

                        return;
                    }

                }


                activarSensores();


                document.getElementById(
                    "activar"
                ).textContent =
                    "Sensores activados";


            } catch (error) {

                console.error(
                    "Error activando sensores:",
                    error
                );

            }

        }
    );


// =====================================================
// DIBUJAR CIELO
// =====================================================

function dibujarCielo() {

    if (
        latitud === undefined ||
        longitud === undefined ||
        estrellas.length === 0
    ) {
        return;
    }


    const ancho =
        window.innerWidth;

    const alto =
        window.innerHeight;


    ctx.clearRect(
        0,
        0,
        ancho,
        alto
    );


    // =================================================
    // FONDO OSCURO
    // =================================================

    ctx.fillStyle =
        "#02030a";

    ctx.fillRect(
        0,
        0,
        ancho,
        alto
    );


    const centroX =
        ancho / 2;

    const centroY =
        alto / 2;


    // =================================================
    // ESTRELLAS
    // =================================================

    for (
        const estrella of estrellas
    ) {

        if (
            !estrella.RA ||
            !estrella.Dec
        ) {
            continue;
        }


        const ra =
            raAGrados(
                estrella.RA
            );

        const dec =
            decAGrados(
                estrella.Dec
            );


        if (
            ra === null ||
            dec === null
        ) {
            continue;
        }


        const posicion =
            estrellaAltAz(
                ra,
                dec
            );


        // Debajo del horizonte

        if (
            posicion.altitud <= 0
        ) {
            continue;
        }


        // =================================================
        // DIFERENCIA AZIMUT
        // =================================================

        let diferenciaAzimut =
            posicion.azimut -
            heading;


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


        // =================================================
        // DIFERENCIA ALTITUD
        // =================================================

        const altitudTelefono =
            pitch;

        const diferenciaAltitud =
            posicion.altitud -
            altitudTelefono;


        // =================================================
        // CAMPO DE VISIÓN
        // =================================================

        if (
            Math.abs(diferenciaAzimut) >
            FOV_HORIZONTAL / 2
        ) {
            continue;
        }

        if (
            Math.abs(diferenciaAltitud) >
            FOV_VERTICAL / 2
        ) {
            continue;
        }


        // =================================================
        // POSICIÓN
        // =================================================

        const x =
            centroX +

            (
                diferenciaAzimut /
                (FOV_HORIZONTAL / 2)
            ) *

            centroX;


        const y =
            centroY -

            (
                diferenciaAltitud /
                (FOV_VERTICAL / 2)
            ) *

            centroY;


        // =================================================
        // MAGNITUD
        // =================================================

        const magnitud =
            Number(estrella.V);

        if (
            Number.isNaN(magnitud)
        ) {
            continue;
        }


        const radio =
            Math.max(
                0.5,
                3.5 -
                magnitud * 0.45
            );


        const brillo =
            Math.max(
                0.15,

                Math.min(
                    1,
                    1.2 -
                    magnitud / 8
                )
            );


        // =================================================
        // DIBUJAR
        // =================================================

        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radio,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            `rgba(255,255,255,${brillo})`;

        ctx.fill();

    }

}


// =====================================================
// REDIMENSIONAR CANVAS
// =====================================================

function redimensionarCanvas() {

    const escala =
        window.devicePixelRatio ||
        1;

    canvas.width =
        window.innerWidth *
        escala;

    canvas.height =
        window.innerHeight *
        escala;

    canvas.style.width =
        window.innerWidth +
        "px";

    canvas.style.height =
        window.innerHeight +
        "px";


    ctx.setTransform(
        escala,
        0,
        0,
        escala,
        0,
        0
    );


    dibujarCielo();

}


window.addEventListener(
    "resize",
    redimensionarCanvas
);


// =====================================================
// CÁMARA
// =====================================================

async function iniciarCamara() {

    try {

        const transmision =
            await navigator.mediaDevices
                .getUserMedia({

                    video: {
                        facingMode:
                            "environment"
                    }

                });


        document.getElementById(
            "camara"
        ).srcObject =
            transmision;


    } catch (error) {

        console.error(
            "Error al iniciar la cámara:",
            error
        );

    }

}


// =====================================================
// DÍA / NOCHE
// =====================================================

function actualizarCieloDiaNoche() {

    if (
        latitud === undefined ||
        longitud === undefined
    ) {
        return;
    }


    const fondo =
        document.getElementById(
            "fondoCielo"
        );

    if (!fondo) {
        return;
    }


    const ahora =
        new Date();


    const observador =
        new Astronomy.Observer(
            latitud,
            longitud,
            0
        );


    const sol =
        Astronomy.Equator(
            Astronomy.Body.Sun,
            ahora,
            observador,
            true,
            true
        );


    const horizonte =
        Astronomy.Horizon(
            ahora,
            observador,
            sol.ra,
            sol.dec,
            "normal"
        );


    const altitudSol =
        horizonte.altitude;


    // =================================================
    // DÍA
    // =================================================

    if (
        altitudSol > 6
    ) {

        fondo.style.backgroundImage =
            'url("./cielo-dia.jpg")';

    }


    // =================================================
    // CREPÚSCULO
    // =================================================

    else if (
        altitudSol > -6
    ) {

        fondo.style.backgroundImage =
            'url("./cielo-noche.jpg")';

    }


    // =================================================
    // NOCHE
    // =================================================

    else {

        fondo.style.backgroundImage =
            'url("./cielo-noche.jpg")';

    }


    console.log(
        "☀️ Altitud del Sol:",
        altitudSol.toFixed(2)
    );

}


// =====================================================
// ACTUALIZAR DÍA/NOCHE CADA MINUTO
// =====================================================

setInterval(
    actualizarCieloDiaNoche,
    60000
);


// =====================================================
// INICIO
// =====================================================

escribir();

iniciarCamara();