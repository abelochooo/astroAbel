const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");
const ubi = document.getElementById("ubi");

let latitud;
let longitud;


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

            console.log("Latitud:", latitud);
            console.log("Longitud:", longitud);


            try {

                const resultado = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${latitud}&lon=${longitud}&format=json`
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
                    municipality ||
                    "Ubicación desconocida";


                ubicacion.textContent =
                    `${ciudad}, ${country}`;


                ubi.textContent =
                    `${ciudad}, ${country}`;


            } catch (error) {

                console.error(
                    "Error obteniendo la ciudad:",
                    error
                );

                ubicacion.textContent =
                    "Ubicación obtenida";

            }


            // =========================================
            // AQUÍ SE MANTIENE TU EFECTO ORIGINAL
            // =========================================

            setTimeout(() => {

                ubicacionDiv.remove();

            }, 3000);

        },


        (error) => {

            console.error(
                "Error de geolocalización:",
                error
            );

            ubicacion.textContent =
                "No se pudo obtener la ubicación.";

        }

    );

}


// =====================================================
// CÁMARA
// =====================================================

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
            "Error al iniciar la cámara:",
            error
        );

    }

}


// =====================================================
// INICIO
// =====================================================

escribir();

iniciarCamara();


// =====================================================
// SENSORES
// =====================================================

document
    .getElementById("activar")
    .addEventListener("click", async () => {

        if (
            typeof DeviceOrientationEvent.requestPermission ===
            "function"
        ) {

            const permiso =
                await DeviceOrientationEvent.requestPermission();


            if (permiso !== "granted") {

                return;

            }

        }


        let ultimaActualizacion = 0;


        window.addEventListener(
            "deviceorientation",
            (e) => {

                const ahora = Date.now();


                if (
                    ahora - ultimaActualizacion <
                    100
                ) {

                    return;

                }


                ultimaActualizacion = ahora;


                document.getElementById(
                    "direccion"
                ).textContent =
                    e.alpha?.toFixed(1) + "°";


                document.getElementById(
                    "altitud"
                ).textContent =
                    e.beta?.toFixed(1) + "°";

            }
        );

    });

    fetch("estrellas.json")
    .then(respuesta => {
        console.log("Respuesta:", respuesta.status);
        return respuesta.json();
    })
    .then(datos => {
        console.log("⭐ Estrellas:", datos.length);
        console.log("Primera:", datos[0]);
    })
    .catch(error => {
        console.error("❌ Error cargando estrellas:", error);
    });

    // =====================================================
// CIELO ESTRELLADO
// =====================================================

let estrellas = [];


// Cargar estrellas
async function cargarEstrellas() {

    try {

        const respuesta = await fetch("estrellas.json");

        estrellas = await respuesta.json();

        console.log("⭐ Estrellas cargadas:", estrellas.length);

        dibujarEstrellas();

    } catch (error) {

        console.error("❌ Error cargando estrellas:", error);

    }
}


// -----------------------------------------------------
// RA: "21h 24m 09.6s" -> grados
// -----------------------------------------------------

function raAGrados(ra) {

    const partes = ra.match(
        /(\d+)h\s*(\d+)m\s*([\d.]+)s/
    );

    if (!partes) return null;

    const horas = Number(partes[1]);
    const minutos = Number(partes[2]);
    const segundos = Number(partes[3]);

    return (
        horas +
        minutos / 60 +
        segundos / 3600
    ) * 15;
}


// -----------------------------------------------------
// DEC: "-20° 51′ 07″" -> grados
// -----------------------------------------------------

function decAGrados(dec) {

    const partes = dec.match(
        /([+-])(\d+)°\s*(\d+)′\s*(\d+(?:\.\d+)?)″/
    );

    if (!partes) return null;

    const signo = partes[1] === "-" ? -1 : 1;

    const grados = Number(partes[2]);
    const minutos = Number(partes[3]);
    const segundos = Number(partes[4]);

    return signo * (
        grados +
        minutos / 60 +
        segundos / 3600
    );
}


// -----------------------------------------------------
// DIBUJAR
// -----------------------------------------------------

function dibujarEstrellas() {

    const cielo = document.getElementById("cielo");

    const ancho = window.innerWidth;
    const alto = window.innerHeight;

    cielo.width = ancho;
    cielo.height = alto;

    const ctx = cielo.getContext("2d");

    ctx.clearRect(0, 0, ancho, alto);

    for (const estrella of estrellas) {

        if (!estrella.RA || !estrella.Dec) {
            continue;
        }

        const ra = raAGrados(estrella.RA);
        const dec = decAGrados(estrella.Dec);

        if (ra === null || dec === null) {
            continue;
        }

        /*
         * DE MOMENTO hacemos una proyección sencilla.
         *
         * Esto NO es todavía el cielo real.
         * Es solamente para comprobar que las
         * 9096 estrellas aparecen.
         */

        const x =
            ((ra / 360) * ancho);

        const y =
            ((90 - dec) / 180) * alto;


        // Magnitud de la estrella

        const magnitud = Number(estrella.V);

        if (isNaN(magnitud)) {
            continue;
        }


        // Las estrellas más brillantes son más grandes

        const radio = Math.max(
            0.5,
            3.5 - magnitud * 0.45
        );


        const brillo = Math.max(
            0.2,
            Math.min(
                1,
                1.2 - magnitud / 8
            )
        );


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

    console.log("✨ Estrellas dibujadas");

}


// =====================================================
// INICIAR
// =====================================================

cargarEstrellas();


// Redibujar cuando cambie el tamaño
window.addEventListener(
    "resize",
    dibujarEstrellas
);

