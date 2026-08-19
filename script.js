const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");
const ubi = document.getElementById("ubi");

let latitud;
let longitud;

const texto = "Tu ubicación es";
let i = 0;


// ========================================
// ESCRIBIR "TU UBICACIÓN ES"
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


// ========================================
// OBTENER UBICACIÓN
// ========================================

async function obtenerUbicacion() {

    if (!navigator.geolocation) {
        ubicacion.textContent = "Tu navegador no permite obtener la ubicación";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {

            latitud = coords.latitude;
            longitud = coords.longitude;

            console.log("📍 Latitud:", latitud);
            console.log("📍 Longitud:", longitud);


            // --------------------------------
            // OBTENER NOMBRE DE LA CIUDAD
            // --------------------------------

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
                    "Error obteniendo el nombre de la ubicación:",
                    error
                );

                ubicacion.textContent =
                    `${latitud.toFixed(4)}, ${longitud.toFixed(4)}`;

                ubi.textContent =
                    `${latitud.toFixed(4)}, ${longitud.toFixed(4)}`;
            }


            // --------------------------------
            // CALCULAR ASTRONOMÍA
            // --------------------------------

            calcularSol();


            // --------------------------------
            // QUITAR PANTALLA DE UBICACIÓN
            // --------------------------------

            setTimeout(() => {

                if (ubicacionDiv) {
                    ubicacionDiv.remove();
                }

            }, 3000);

        },

        (error) => {

            console.error(
                "Error obteniendo ubicación:",
                error
            );

            ubicacion.textContent =
                "No se pudo obtener tu ubicación";
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}


// ========================================
// ASTRONOMÍA
// ========================================

function calcularSol() {

    if (
        latitud === undefined ||
        longitud === undefined
    ) {
        console.log("Todavía no tenemos ubicación");
        return;
    }

    if (typeof Astronomy === "undefined") {

        console.error(
            "Astronomy Engine no está cargado."
        );

        return;
    }


    const ahora = new Date();


    // --------------------------------
    // OBSERVADOR
    // --------------------------------

    const observador = new Astronomy.Observer(
        latitud,
        longitud,
        0
    );


    // --------------------------------
    // POSICIÓN ECUATORIAL DEL SOL
    // --------------------------------

    const equator = Astronomy.Equator(
        Astronomy.Body.Sun,
        ahora,
        observador,
        true,
        true
    );


    // --------------------------------
    // CONVERTIR A AZIMUT + ALTITUD
    // --------------------------------

    const horizontal = Astronomy.Horizon(
        ahora,
        observador,
        equator.ra,
        equator.dec,
        "normal"
    );


    console.log("======================");
    console.log("☀️ POSICIÓN REAL DEL SOL");
    console.log("======================");

    console.log(
        "Azimut:",
        horizontal.azimuth.toFixed(2) + "°"
    );

    console.log(
        "Altitud:",
        horizontal.altitude.toFixed(2) + "°"
    );


    // --------------------------------
    // MOSTRAR INFORMACIÓN
    // --------------------------------

    if (ubi) {

        ubi.textContent =
            `${ubi.textContent} | ☀️ ${horizontal.azimuth.toFixed(1)}°`;
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

        if (camara) {

            camara.srcObject = transmision;

        }

    } catch (error) {

        console.error(
            "No se pudo iniciar la cámara:",
            error
        );

    }
}


// ========================================
// ORIENTACIÓN DEL MÓVIL
// ========================================

document
    .getElementById("activar")
    .addEventListener("click", async () => {


        // --------------------------------
        // PERMISO EN IPHONE
        // --------------------------------

        if (
            typeof DeviceOrientationEvent.requestPermission ===
            "function"
        ) {

            try {

                const permiso =
                    await DeviceOrientationEvent.requestPermission();

                if (permiso !== "granted") {

                    console.log(
                        "Permiso de orientación rechazado"
                    );

                    return;
                }

            } catch (error) {

                console.error(
                    "Error solicitando permiso:",
                    error
                );

                return;
            }
        }


        // --------------------------------
        // ESCUCHAR ORIENTACIÓN
        // --------------------------------

        let ultimaActualizacion = 0;


        window.addEventListener(
            "deviceorientation",
            (e) => {

                const ahora = Date.now();


                // No actualizar demasiado rápido

                if (
                    ahora - ultimaActualizacion <
                    100
                ) {
                    return;
                }


                ultimaActualizacion = ahora;


                // --------------------------------
                // ALPHA = ROTACIÓN
                // BETA = INCLINACIÓN
                // GAMMA = INCLINACIÓN LATERAL
                // --------------------------------

                const alpha =
                    e.alpha ?? 0;

                const beta =
                    e.beta ?? 0;

                const gamma =
                    e.gamma ?? 0;


                document
                    .getElementById("direccion")
                    .textContent =
                    alpha.toFixed(1) + "°";


                document
                    .getElementById("altitud")
                    .textContent =
                    beta.toFixed(1) + "°";


                console.log(
                    "🧭 Orientación:",
                    {
                        alpha,
                        beta,
                        gamma
                    }
                );

            }
        );

    });


// ========================================
// INICIAR
// ========================================

escribir();

iniciarCamara();
