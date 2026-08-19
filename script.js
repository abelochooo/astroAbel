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


// ========================================
// TAMAÑO DEL CANVAS
// ========================================

function ajustarCanvas() {
    canvas.width = window.innerWidth * devicePixelRatio;
    canvas.height = window.innerHeight * devicePixelRatio;

    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    ctx.setTransform(
        devicePixelRatio,
        0,
        0,
        devicePixelRatio,
        0,
        0
    );
}

window.addEventListener("resize", ajustarCanvas);
ajustarCanvas();


// ========================================
// CARGAR ESTRELLAS
// ========================================

async function cargarEstrellas() {

    try {

        const respuesta = await fetch("datos/estrellas.json");

        estrellas = await respuesta.json();

        console.log("⭐ Estrellas cargadas:", estrellas.length);

        dibujarCielo();

    } catch (error) {

        console.error(
            "❌ No se pudo cargar estrellas.json:",
            error
        );

    }
}


// ========================================
// UBICACIÓN
// ========================================

function escribir() {

    if (i < texto.length) {

        texto1.textContent += texto[i];

        i++;

        setTimeout(escribir, 100);

    } else {

        obtenerUbicacion();

    }
}


async function obtenerUbicacion() {

    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {

            latitud = coords.latitude;
            longitud = coords.longitude;

            console.log("📍 Latitud:", latitud);
            console.log("📍 Longitud:", longitud);


            try {

                const resultado = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json`
                );

                const informacion = await resultado.json();

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

            }


            if (ubicacionDiv) {

                setTimeout(() => {
                    ubicacionDiv.remove();
                }, 3000);

            }


            dibujarCielo();

        },

        (error) => {

            console.error(
                "❌ Error GPS:",
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


// ========================================
// CONVERTIR RA/DEC → AZIMUT/ALTITUD
// ========================================

function posicionEstrella(estrella) {

    if (
        latitud === undefined ||
        longitud === undefined
    ) {
        return null;
    }


    /*
        IMPORTANTE:

        El JSON puede utilizar distintos nombres.
        Intentamos detectar los habituales.
    */

    const ra =
        estrella.ra ??
        estrella.RA ??
        estrella.rightAscension;

    const dec =
        estrella.dec ??
        estrella.Dec ??
        estrella.declination;

    if (
        ra === undefined ||
        dec === undefined
    ) {
        return null;
    }


    const fecha = new Date();


    const observador =
        new Astronomy.Observer(
            latitud,
            longitud,
            0
        );


    /*
        Astronomy Engine espera RA en horas.
    */

    const ecuatorial =
        Astronomy.Equator(
            Astronomy.Body.Star,
            fecha,
            observador,
            true,
            true
        );

    /*
        Para estrellas necesitamos convertir
        RA/Dec manualmente a coordenadas horizontales.
    */

    const jd =
        Astronomy.MakeTime(fecha).tt;

    const sidereal =
        Astronomy.SiderealTime(fecha, longitud);


    let raHoras = Number(ra);

    let declinacion =
        Number(dec);


    // Si RA viene en grados en lugar de horas
    if (Math.abs(raHoras) > 24) {
        raHoras /= 15;
    }


    const raGrados =
        raHoras * 15;


    const anguloHora =
        sidereal * 15 -
        raGrados;


    const lat =
        latitud *
        Math.PI / 180;

    const decRad =
        declinacion *
        Math.PI / 180;

    const ha =
        anguloHora *
        Math.PI / 180;


    const sinAlt =
        Math.sin(lat) *
        Math.sin(decRad) +
        Math.cos(lat) *
        Math.cos(decRad) *
        Math.cos(ha);


    const alt =
        Math.asin(sinAlt);


    let az =
        Math.atan2(
            Math.sin(ha),
            Math.cos(ha) * Math.sin(lat) -
            Math.tan(decRad) * Math.cos(lat)
        );


    az =
        az * 180 / Math.PI + 180;


    const altGrados =
        alt * 180 / Math.PI;


    return {
        azimut: az,
        altitud: altGrados
    };
}


// ========================================
// DIBUJAR CIELO
// ========================================

function dibujarCielo() {

    if (!ctx) return;


    const ancho = window.innerWidth;
    const alto = window.innerHeight;


    // Fondo
    ctx.fillStyle = "#02030a";
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


    for (const estrella of estrellas) {

        const posicion =
            posicionEstrella(estrella);


        if (!posicion) continue;


        let azimut =
            posicion.azimut -
            direccionMovil;


        let altitud =
            posicion.altitud -
            inclinacionMovil;


        /*
            Normalizamos el azimut.
        */

        while (azimut < -180) {
            azimut += 360;
        }

        while (azimut > 180) {
            azimut -= 360;
        }


        /*
            Solo mostramos estrellas
            que están sobre el horizonte.
        */

        if (posicion.altitud < 0) {
            continue;
        }


        /*
            Campo de visión aproximado.
        */

        const campoHorizontal = 90;
        const campoVertical = 60;


        if (
            Math.abs(azimut) >
            campoHorizontal / 2
        ) {
            continue;
        }


        if (
            Math.abs(altitud) >
            campoVertical / 2
        ) {
            continue;
        }


        const x =
            ancho / 2 +
            (azimut /
                (campoHorizontal / 2)) *
            (ancho / 2);


        const y =
            alto / 2 -
            (altitud /
                (campoVertical / 2)) *
            (alto / 2);


        /*
            Magnitud de la estrella.
        */

        const magnitud =
            estrella.mag ??
            estrella.Mag ??
            estrella.magnitude ??
            4;


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


        ctx.beginPath();

        ctx.arc(
            x,
            y,
            radio,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            `rgba(255,255,255,${Math.min(
                1,
                0.3 + brillo / 5
            )})`;

        ctx.fill();
    }
}


// ========================================
// CÁMARA
// ========================================

async function iniciarCamara() {

    try {

        const transmision =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment"
                }
            });

        const camara =
            document.getElementById("camara");

        camara.srcObject =
            transmision;

    } catch (error) {

        console.error(
            "❌ Cámara:",
            error
        );

    }
}


// ========================================
// SENSORES
// ========================================

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


            window.addEventListener(
                "deviceorientation",
                (e) => {

                    direccionMovil =
                        e.alpha ?? 0;

                    inclinacionMovil =
                        e.beta ?? 0;


                    document
                        .getElementById(
                            "direccion"
                        )
                        .textContent =
                        direccionMovil
                            .toFixed(1) + "°";


                    document
                        .getElementById(
                            "altitud"
                        )
                        .textContent =
                        inclinacionMovil
                            .toFixed(1) + "°";


                    dibujarCielo();

                }
            );

        }
    );


// ========================================
// ACTUALIZAR CIELO
// ========================================

setInterval(
    dibujarCielo,
    1000
);


// ========================================
// INICIAR
// ========================================

cargarEstrellas();

escribir();

iniciarCamara();
