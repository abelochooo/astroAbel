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
