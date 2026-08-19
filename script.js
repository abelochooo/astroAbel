const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");
const ubi = document.getElementById("ubi");

const canvas = document.getElementById("cielo");
const ctx = canvas.getContext("2d");

let latitud;
let longitud;

let estrellas = [];

let direccionMovil = 0;
let inclinacionMovil = 0;

const texto = "Tu ubicación es";
let i = 0;


// =====================================================
// CANVAS
// =====================================================

function ajustarCanvas() {

    const dpr = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );
}

window.addEventListener("resize", () => {

    ajustarCanvas();

    dibujarCielo();

});

ajustarCanvas();


// =====================================================
// CARGAR ESTRELLAS
// =====================================================

async function cargarEstrellas() {

    try {

        const respuesta =
            await fetch("datos/estrellas.json");

        if (!respuesta.ok) {

            throw new Error(
                `HTTP ${respuesta.status}`
            );

        }

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

        ubi.textContent =
            "Error cargando estrellas";

    }
}


// =====================================================
// UBICACIÓN
// =====================================================

function escribir() {

    if (i < texto.length) {

        texto1.textContent += texto[i];

        i++;

        setTimeout(
            escribir,
            100
        );

    } else {

        obtenerUbicacion();

    }
}


function obtenerUbicacion() {

    if (!navigator.geolocation) {

        console.error(
            "❌ El navegador no soporta GPS"
        );

        return;

    }


    navigator.geolocation.getCurrentPosition(

        async ({ coords }) => {

            latitud =
                coords.latitude;

            longitud =
                coords.longitude;


            console.log(
                "📍 Latitud:",
                latitud
            );

            console.log(
                "📍 Longitud:",
                longitud
            );


            try {

                const resultado =
                    await fetch(
                        `https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json`
                    );


                const informacion =
                    await resultado.json();


                const direccion =
                    informacion.address || {};


                const ciudad =
                    direccion.city ||
                    direccion.town ||
                    direccion.village ||
                    direccion.municipality ||
                    "Ubicación desconocida";


                const pais =
                    direccion.country ||
                    "";


                ubicacion.textContent =
                    `${ciudad}, ${pais}`;


                ubi.textContent =
                    `${ciudad}, ${pais}`;


            } catch (error) {

                console.error(
                    "❌ Error obteniendo ciudad:",
                    error
                );

            }


            setTimeout(() => {

                if (ubicacionDiv) {
                    ubicacionDiv.remove();
                }

            }, 3000);


            dibujarCielo();

        },


        (error) => {

            console.error(
                "❌ Error obteniendo ubicación:",
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
// CONVERTIR RA
//
// Ejemplo:
//
// "21h 24m 09.6s"
//
// → 21.402666... horas
// =====================================================

function convertirRA(raTexto) {

    if (!raTexto) {
        return null;
    }


    const partes =
        raTexto.match(
            /(\d+(?:\.\d+)?)h\s*(\d+(?:\.\d+)?)m\s*(\d+(?:\.\d+)?)s/
        );


    if (!partes) {

        console.error(
            "❌ RA no válida:",
            raTexto
        );

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
// CONVERTIR DECLINACIÓN
//
// Ejemplo:
//
// "-20° 51′ 07″"
//
// → -20.8519...
// =====================================================

function convertirDec(decTexto) {

    if (!decTexto) {
        return null;
    }


    const partes =
        decTexto.match(
            /([+-])(\d+)°\s*(\d+)′\s*(\d+(?:\.\d+)?)″/
        );


    if (!partes) {

        console.error(
            "❌ Dec no válida:",
            decTexto
        );

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
//
// RA/Dec
//       ↓
// Azimut/Altitud
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
        convertirRA(
            estrella.RA
        );


    const decGrados =
        convertirDec(
            estrella.Dec
        );


    if (
        raHoras === null ||
        decGrados === null
    ) {

        return null;

    }


    const fecha =
        new Date();


    // =================================================
    // TIEMPO SIDÉREO LOCAL
    // =================================================

    const sidereal =
        Astronomy.SiderealTime(
            fecha,
            longitud
        );


    // RA en grados

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


    // =================================================
    // RADIANES
    // =================================================

    const latRad =
        latitud *
        Math.PI / 180;


    const decRad =
        decGrados *
        Math.PI / 180;


    const haRad =
        anguloHora *
        Math.PI / 180;


    // =================================================
    // ALTITUD
    // =================================================

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


    // =================================================
    // AZIMUT
    // =================================================

    const azRad =
        Math.atan2(

            Math.sin(haRad),

            Math.cos(haRad) *
                Math.sin(latRad)
            -
            Math.tan(decRad) *
                Math.cos(latRad)

        );


    let azimut =
        azRad *
        180 /
        Math.PI
        +
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


    // =================================================
    // FONDO
    // =================================================

    ctx.fillStyle =
        "#02030a";


    ctx.fillRect(
        0,
        0,
        ancho,
        alto
    );


    // =================================================
    // TODAVÍA NO TENEMOS GPS
    // =================================================

    if (
        latitud === undefined ||
        longitud === undefined
    ) {

        return;

    }


    // =================================================
    // TODAVÍA NO TENEMOS ESTRELLAS
    // =================================================

    if (
        estrellas.length === 0
    ) {

        return;

    }


    // =================================================
    // CAMPO DE VISIÓN
    //
    // Esta primera versión muestra aproximadamente
    // 90° horizontalmente y 60° verticalmente.
    // =================================================

    const campoHorizontal =
        90;

    const campoVertical =
        60;


    // =================================================
    // CENTRO DEL CIELO
    //
    // TEMPORALMENTE:
    //
    // 180° = dirección central
    // 45°  = altitud central
    //
    // Más adelante lo sustituiremos por la brújula.
    // =================================================

    const centroAzimut =
        180;

    const centroAltitud =
        45;


    // =================================================
    // ESTRELLAS
    // =================================================

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


        // =============================================
        // SOLO ESTRELLAS SOBRE EL HORIZONTE
        // =============================================

        if (
            posicion.altitud <= 0
        ) {

            continue;

        }


        // =============================================
        // DIFERENCIA DE AZIMUT
        // =============================================

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


        // =============================================
        // DIFERENCIA DE ALTITUD
        // =============================================

        const diferenciaAltitud =
            posicion.altitud -
            centroAltitud;


        // =============================================
        // FUERA DE LA PANTALLA
        // =============================================

        if (
            Math.abs(
                diferenciaAzimut
            ) >
            campoHorizontal / 2
        ) {

            continue;

        }


        if (
            Math.abs(
                diferenciaAltitud
            ) >
            campoVertical / 2
        ) {

            continue;

        }


        // =============================================
        // POSICIÓN X
        // =============================================

        const x =
            ancho / 2 +

            (
                diferenciaAzimut /
                (campoHorizontal / 2)
            ) *

            (
                ancho / 2
            );


        // =============================================
        // POSICIÓN Y
        // =============================================

        const y =
            alto / 2 -

            (
                diferenciaAltitud /
                (campoVertical / 2)
            ) *

            (
                alto / 2
            );


        // =============================================
        // MAGNITUD
        // =============================================

        const magnitud =
            Number(
                estrella.V
            );


        if (
            Number.isNaN(
                magnitud
            )
        ) {

            continue;

        }


        // =============================================
        // TAMAÑO DE LA ESTRELLA
        //
        // Magnitud pequeña = estrella brillante
        // =============================================

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
            brillo *
            0.35;


        // =============================================
        // BRILLO
        // =============================================

        const opacidad =
            Math.max(
                0.35,
                Math.min(
                    1,
                    1.15 -
                    magnitud / 7
                )
            );


        // =============================================
        // DIBUJAR ESTRELLA
        // =============================================

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


        // =============================================
        // ESTRELLAS MUY BRILLANTES
        // =============================================

        if (
            magnitud < 1.5
        ) {

            ctx.beginPath();


            ctx.arc(
                x,
                y,
                radio * 2.5,
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
                    radio * 2.5
                );


            gradiente.addColorStop(
                0,
                "rgba(255,255,255,0.35)"
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

                        facingMode:
                            "environment"

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
// SENSORES
// =====================================================

document
    .getElementById(
        "activar"
    )
    .addEventListener(
        "click",
        async () => {


            // =========================================
            // iPhone / iPad
            // =========================================

            if (
                typeof DeviceOrientationEvent
                    .requestPermission ===
                "function"
            ) {

                try {

                    const permiso =
                        await DeviceOrientationEvent
                            .requestPermission();


                    if (
                        permiso !==
                        "granted"
                    ) {

                        console.log(
                            "❌ Permiso sensores rechazado"
                        );

                        return;

                    }

                } catch (error) {

                    console.error(
                        "❌ Error sensores:",
                        error
                    );

                    return;

                }

            }


            console.log(
                "🧭 Sensores activados"
            );


            // =========================================
            // ORIENTACIÓN
            // =========================================

            window.addEventListener(
                "deviceorientation",
                (e) => {


                    if (
                        e.alpha !== null
                    ) {

                        direccionMovil =
                            e.alpha;

                    }


                    if (
                        e.beta !== null
                    ) {

                        inclinacionMovil =
                            e.beta;

                    }


                    document
                        .getElementById(
                            "direccion"
                        )
                        .textContent =
                        direccionMovil
                            .toFixed(1)
                        + "°";


                    document
                        .getElementById(
                            "altitud"
                        )
                        .textContent =
                        inclinacionMovil
                            .toFixed(1)
                        + "°";


                    /*
                        Todavía no utilizamos
                        la orientación para
                        mover las estrellas.

                        Primero comprobamos
                        que el cielo funciona.
                    */


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


// =====================================================
// INICIAR
// =====================================================

console.log(
    "🌌 Iniciando cielo..."
);


cargarEstrellas();

escribir();

iniciarCamara();
