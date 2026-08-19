const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");

const canvas = document.getElementById("cieloCamara");
const ctx = canvas.getContext("2d");

const direccionElemento = document.getElementById("direccion");
const altitudElemento = document.getElementById("altitud");

let latitud;
let longitud;

let estrellas = [];
let constelaciones = [];


// =====================================================
// ORIENTACIÓN
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


            } catch (error) {

                console.error(
                    "Error obteniendo ciudad:",
                    error
                );

                ubicacion.textContent =
                    "Ubicación obtenida";

            }


            // Cargar estrellas y constelaciones

            cargarEstrellas();

            cargarConstelaciones();


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

            if (texto1) {

                texto1.textContent =
                    "No se pudo obtener tu ubicación";

            }

            if (ubicacion) {

                ubicacion.textContent =
                    `Código de error: ${error.code} - ${error.message}`;

            }

            setTimeout(() => {

                if (ubicacionDiv) {
                    ubicacionDiv.remove();
                }

            }, 3000);

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
            "⭐ Estrellas cargadas:",
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
// CARGAR CONSTELACIONES
// =====================================================

async function cargarConstelaciones() {

    try {

        const respuesta =
            await fetch("constelaciones.json");

        if (!respuesta.ok) {

            throw new Error(
                `HTTP ${respuesta.status}`
            );

        }

        constelaciones =
            await respuesta.json();

        console.log(
            "✨ Constelaciones cargadas:",
            constelaciones.length
        );

        dibujarCielo();


    } catch (error) {

        console.error(
            "Error cargando constelaciones:",
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
// RA / DEC → AZIMUT / ALTITUD
// =====================================================

function estrellaAltAz(ra, dec, lst) {

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
// PROYECTAR PUNTO (RA/Dec en grados → x, y en pantalla)
// =====================================================
// Devuelve null si el punto está fuera del horizonte
// o fuera del campo de visión actual.

function proyectarPunto(ra, dec, lst, centroX, centroY) {

    const posicion =
        estrellaAltAz(ra, dec, lst);


    if (posicion.altitud <= 0) {
        return null;
    }


    let diferenciaAzimut =
        posicion.azimut -
        heading;


    while (diferenciaAzimut > 180) {
        diferenciaAzimut -= 360;
    }

    while (diferenciaAzimut < -180) {
        diferenciaAzimut += 360;
    }


    const diferenciaAltitud =
        posicion.altitud -
        pitch;


    if (
        Math.abs(diferenciaAzimut) >
        FOV_HORIZONTAL / 2
    ) {
        return null;
    }

    if (
        Math.abs(diferenciaAltitud) >
        FOV_VERTICAL / 2
    ) {
        return null;
    }


    const x =
        centroX +
        (diferenciaAzimut / (FOV_HORIZONTAL / 2)) *
        centroX;

    const y =
        centroY -
        (diferenciaAltitud / (FOV_VERTICAL / 2)) *
        centroY;


    return { x, y };

}


// =====================================================
// DIBUJAR CONSTELACIONES
// =====================================================

function dibujarConstelaciones(lst, centroX, centroY) {

    ctx.strokeStyle =
        "rgba(120, 170, 255, 0.55)";

    ctx.lineWidth = 1;


    for (const constelacion of constelaciones) {

        // Para el nombre, usamos el primer punto visible que encontremos

        let puntoParaNombre = null;


        for (const linea of constelacion.lineas) {

            ctx.beginPath();

            let hayTrazo = false;


            for (let i = 0; i < linea.length - 1; i++) {

                const [ra1, dec1] = linea[i];
                const [ra2, dec2] = linea[i + 1];

                const p1 =
                    proyectarPunto(ra1, dec1, lst, centroX, centroY);

                const p2 =
                    proyectarPunto(ra2, dec2, lst, centroX, centroY);


                // Solo dibujamos el segmento si AMBOS extremos
                // están dentro del campo de visión actual.

                if (p1 && p2) {

                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);

                    hayTrazo = true;


                    if (!puntoParaNombre) {
                        puntoParaNombre = p1;
                    }

                }

            }


            if (hayTrazo) {
                ctx.stroke();
            }

        }


        // =================================================
        // NOMBRE DE LA CONSTELACIÓN
        // =================================================

        if (puntoParaNombre) {

            ctx.font =
                "13px Arial, sans-serif";

            ctx.fillStyle =
                "rgba(180, 210, 255, 0.75)";

            ctx.fillText(
                constelacion.nombre,
                puntoParaNombre.x + 6,
                puntoParaNombre.y - 6
            );

        }

    }

}


// =====================================================
// ACTIVAR SENSORES
// =====================================================

function activarSensores() {

    let ultimaActualizacion = 0;


    window.addEventListener(
        "deviceorientation",
        evento => {

            const ahora =
                Date.now();


            if (
                ahora -
                ultimaActualizacion <
                30
            ) {
                return;
            }


            ultimaActualizacion =
                ahora;


            let nuevoHeading;


            // =================================================
            // IPHONE / IPAD
            // =================================================

            if (
                typeof evento.webkitCompassHeading ===
                "number"
            ) {

                nuevoHeading =
                    evento.webkitCompassHeading;

            }


            // =================================================
            // ANDROID / OTROS
            // =================================================

            else if (
                typeof evento.alpha ===
                "number"
            ) {

                nuevoHeading =
                    360 -
                    evento.alpha;

            }


            // =================================================
            // DIRECCIÓN
            // =================================================

            if (
                typeof nuevoHeading === "number" &&
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
            // ALTITUD / INCLINACIÓN
            // =================================================

            if (
                typeof evento.beta === "number" &&
                !Number.isNaN(evento.beta)
            ) {

                // 'beta' es la inclinación física del móvil (0 = tumbado
                // en la mesa mirando al cenit, 90 = vertical mirando al
                // horizonte, 180 = boca abajo mirando al suelo).
                // La elevación real de la cámara es su complementario:

                pitch =
                    90 - evento.beta;


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
// BOTÓN
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
// DIBUJAR CIELO (AR sobre la cámara)
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


    // Solo limpiamos: el fondo es el vídeo de la cámara,
    // no pintamos ningún rectángulo opaco encima.

    ctx.clearRect(
        0,
        0,
        ancho,
        alto
    );


    const centroX =
        ancho / 2;

    const centroY =
        alto / 2;


    // Tiempo sideral calculado UNA sola vez por frame,
    // no por cada estrella.

    const lst =
        tiempoSideral();


    // =================================================
    // CONSTELACIONES (debajo de las estrellas)
    // =================================================

    if (constelaciones.length > 0) {

        dibujarConstelaciones(
            lst,
            centroX,
            centroY
        );

    }


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
                dec,
                lst
            );


        // =================================================
        // DEBAJO DEL HORIZONTE
        // =================================================

        if (
            posicion.altitud <= 0
        ) {
            continue;
        }


        // =================================================
        // DIFERENCIA DE AZIMUT
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
        // DIFERENCIA DE ALTITUD
        // =================================================

        const diferenciaAltitud =
            posicion.altitud -
            pitch;


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
        // POSICIÓN EN PANTALLA
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


        // Estrellas brillantes → grandes

        const radio =
            Math.max(
                0.6,
                Math.min(
                    5,
                    3.8 -
                    magnitud * 0.45
                )
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
        // ESTRELLA
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
// INICIO
// =====================================================

escribir();

iniciarCamara();