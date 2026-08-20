const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");

const canvas = document.getElementById("cieloCamara");
const ctx = canvas.getContext("2d");

const direccionElemento = document.getElementById("direccion");
const altitudElemento = document.getElementById("altitud");
const debugElemento = document.getElementById("debug");

let latitud;
let longitud;

let estrellas = [];
let constelaciones = [];


// =====================================================
// ORIENTACIÓN
// =====================================================

let heading = 0;
let pitch = 0;

let headingInicializado = false;

// 1 = sin suavizado (responde instantáneo, pero con cortes).
// Valores bajos = más suave, pero con algo más de "inercia".

const FACTOR_SUAVIZADO_HEADING = 0.15;
const FACTOR_SUAVIZADO_PITCH = 0.25;

// Calibración del horizonte: cada móvil/persona reporta "beta" distinto,
// así que en vez de asumir un valor fijo, se calibra apuntando al horizonte.

let referenciaBeta = null;
let ultimoBetaCrudo = null;

// El FOV real de la cámara varía por modelo de móvil. Empezamos con un
// valor típico de cámara trasera (más estrecho que el 90° anterior,
// que hacía que todo se viera encogido hacia el centro) y se puede
// ajustar en vivo con el slider; se recuerda entre sesiones.

const RELACION_FOV = 50 / 66;

let FOV_HORIZONTAL =
    Number(localStorage.getItem("fovHorizontal")) || 66;

let FOV_VERTICAL =
    Number(localStorage.getItem("fovVertical")) || 50;

// "ar" = cámara real + sensores del móvil
// "libre" = sin cámara, arrastras con el dedo/ratón (como Stellarium de escritorio)

let modo = "ar";


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

            actualizarCuerposCelestes();

            setInterval(actualizarCuerposCelestes, 30000);


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
// VECTORES 3D (para proyección gnomónica correcta)
// =====================================================
// Convención: x = este, y = norte, z = arriba (cenit)

function azAltAVector(azimutDeg, altitudDeg) {

    const az = azimutDeg * Math.PI / 180;
    const alt = altitudDeg * Math.PI / 180;

    const cosAlt = Math.cos(alt);

    return {
        x: cosAlt * Math.sin(az),
        y: cosAlt * Math.cos(az),
        z: Math.sin(alt)
    };

}

function producto(a, b) {

    return a.x * b.x + a.y * b.y + a.z * b.z;

}

function cruz(a, b) {

    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };

}

function normalizar(v) {

    const longitud =
        Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;

    return {
        x: v.x / longitud,
        y: v.y / longitud,
        z: v.z / longitud
    };

}

// Construye la base ortonormal de la cámara (hacia dónde mira,
// su "derecha" y su "arriba") a partir de heading/pitch actuales.

function baseCamara(headingDeg, pitchDeg) {

    const forward =
        azAltAVector(headingDeg, pitchDeg);

    let right =
        normalizar(
            cruz(forward, { x: 0, y: 0, z: 1 })
        );

    // Caso degenerado: mirando casi exactamente al cenit/nadir,
    // el "arriba del mundo" y "forward" quedan paralelos.
    // Usamos un eje de referencia alternativo para ese caso.

    if (
        !isFinite(right.x) ||
        (Math.abs(right.x) < 1e-9 &&
         Math.abs(right.y) < 1e-9 &&
         Math.abs(right.z) < 1e-9)
    ) {

        right =
            normalizar(
                cruz(forward, { x: 1, y: 0, z: 0 })
            );

    }

    const up =
        cruz(right, forward);

    return { forward, right, up };

}


// =====================================================
// SOL, LUNA Y PLANETAS
// =====================================================

let cuerpos = [];

const CUERPOS_A_MOSTRAR = [
    { body: "Sun", nombre: "Sol" },
    { body: "Moon", nombre: "Luna" },
    { body: "Mercury", nombre: "Mercurio" },
    { body: "Venus", nombre: "Venus" },
    { body: "Mars", nombre: "Marte" },
    { body: "Jupiter", nombre: "Júpiter" },
    { body: "Saturn", nombre: "Saturno" }
];


function actualizarCuerposCelestes() {

    if (
        latitud === undefined ||
        longitud === undefined
    ) {
        return;
    }

    if (typeof Astronomy === "undefined") {
        return;
    }


    const ahora =
        new Date();

    const observador =
        new Astronomy.Observer(latitud, longitud, 0);


    cuerpos =
        CUERPOS_A_MOSTRAR
            .map(({ body, nombre }) => {

                try {

                    const ecuatorial =
                        Astronomy.Equator(
                            Astronomy.Body[body],
                            ahora,
                            observador,
                            true,
                            true
                        );

                    const horizonte =
                        Astronomy.Horizon(
                            ahora,
                            observador,
                            ecuatorial.ra,
                            ecuatorial.dec,
                            "normal"
                        );

                    return {
                        nombre,
                        esLuna: nombre === "Luna",
                        azimut: horizonte.azimuth,
                        altitud: horizonte.altitude
                    };

                } catch (error) {

                    console.error(
                        "Error calculando posición de " + nombre,
                        error
                    );

                    return null;

                }

            })
            .filter(Boolean);


    dibujarCielo();

}


// =====================================================
// PROYECTAR PUNTO (RA/Dec en grados → x, y en pantalla)
// =====================================================
// Proyección gnomónica (rectilínea): mucho más fiel que una
// escala lineal de azimut/altitud, sobre todo cerca del cenit.
// Devuelve null si el punto queda fuera de cámara o de pantalla.

function proyectarPunto(ra, dec, lst, base, focalH, focalV, centroX, centroY) {

    const posicion =
        estrellaAltAz(ra, dec, lst);

    return proyectarAltAz(
        posicion.azimut,
        posicion.altitud,
        base,
        focalH,
        focalV,
        centroX,
        centroY
    );

}


// Igual que proyectarPunto, pero para cuando ya tienes azimut/altitud
// calculados directamente (caso de Sol, Luna y planetas vía astronomy-engine).

function proyectarAltAz(azimut, altitud, base, focalH, focalV, centroX, centroY) {

    if (altitud <= 0) {
        return null;
    }


    const punto =
        azAltAVector(azimut, altitud);


    const pf =
        producto(punto, base.forward);


    // Detrás de la cámara (o casi en el límite, 90° de distancia)

    if (pf <= 0.01) {
        return null;
    }


    const px =
        producto(punto, base.right);

    const py =
        producto(punto, base.up);


    const x =
        centroX + focalH * (px / pf);

    const y =
        centroY - focalV * (py / pf);


    // Descarta puntos muy fuera de pantalla (con margen)

    if (
        x < -100 || x > centroX * 2 + 100 ||
        y < -100 || y > centroY * 2 + 100
    ) {
        return null;
    }


    return { x, y };

}


// =====================================================
// DIBUJAR CONSTELACIONES
// =====================================================

function dibujarConstelaciones(lst, base, focalH, focalV, centroX, centroY) {

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
                    proyectarPunto(ra1, dec1, lst, base, focalH, focalV, centroX, centroY);

                const p2 =
                    proyectarPunto(ra2, dec2, lst, base, focalH, focalV, centroX, centroY);


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

            if (modo !== "ar") {
                return;
            }


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


            // === DEPURACIÓN TEMPORAL: valores crudos del sensor ===

            if (debugElemento) {

                debugElemento.textContent =
                    `alpha: ${evento.alpha?.toFixed(1)} | ` +
                    `beta: ${evento.beta?.toFixed(1)} | ` +
                    `gamma: ${evento.gamma?.toFixed(1)}`;

            }


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
            // DIRECCIÓN (suavizada para evitar "cortes" por
            // ruido del magnetómetro/brújula)
            // =================================================

            if (
                typeof nuevoHeading === "number" &&
                !Number.isNaN(nuevoHeading)
            ) {

                const headingNormalizado =
                    (nuevoHeading + 360) % 360;


                if (!headingInicializado) {

                    heading =
                        headingNormalizado;

                    headingInicializado = true;

                } else {

                    // Diferencia más corta entre el heading actual
                    // y el nuevo, teniendo en cuenta el paso 360°→0°

                    let diferencia =
                        headingNormalizado - heading;

                    diferencia =
                        ((diferencia + 180) % 360 + 360) % 360 - 180;


                    // Cerca del cenit el sensor se pone ruidoso: ahí
                    // reforzamos el suavizado automáticamente. Lejos
                    // del cenit (mirando al horizonte) apenas frena.

                    const cercaniaAlCenit =
                        Math.min(1, Math.abs(pitch) / 90);

                    const factorHeadingActual =
                        FACTOR_SUAVIZADO_HEADING *
                        (1 - cercaniaAlCenit * 0.85);


                    heading =
                        (
                            heading +
                            diferencia * factorHeadingActual +
                            360
                        ) % 360;

                }


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

                ultimoBetaCrudo =
                    evento.beta;


                // Hasta que el usuario calibre, usamos 90 como
                // referencia provisional (puede estar bastante desviada).

                const referencia =
                    referenciaBeta !== null ?
                        referenciaBeta :
                        90;


                let pitchCrudo =
                    evento.beta - referencia;


                // Límite de seguridad: cerca de ±90° (mirando casi recto
                // hacia arriba/abajo) la brújula del móvil se vuelve
                // inestable por sí misma (limitación física del sensor,
                // no del código) y "tiembla". Topamos un poco antes.

                pitchCrudo =
                    Math.max(-89, Math.min(89, pitchCrudo));


                // Suavizado, igual que con el heading, para que no
                // se note cada pequeño salto del sensor.

                pitch =
                    pitch +
                    (pitchCrudo - pitch) * FACTOR_SUAVIZADO_PITCH;


                altitudElemento.textContent =
                    pitch.toFixed(1) +
                    "°" +
                    (referenciaBeta === null ? " (sin calibrar)" : "");

            }


            dibujarCielo();

        },
        true
    );

}


// =====================================================
// CALIBRAR CAMPO DE VISIÓN (FOV)
// =====================================================

const fovSlider =
    document.getElementById("fovSlider");

const fovValorTexto =
    document.getElementById("fovValor");


if (fovSlider) {

    fovSlider.value = FOV_HORIZONTAL;

    if (fovValorTexto) {
        fovValorTexto.textContent = FOV_HORIZONTAL + "°";
    }


    fovSlider.addEventListener(
        "input",
        () => {

            FOV_HORIZONTAL =
                Number(fovSlider.value);

            FOV_VERTICAL =
                Math.round(FOV_HORIZONTAL * RELACION_FOV);


            if (fovValorTexto) {
                fovValorTexto.textContent = FOV_HORIZONTAL + "°";
            }


            localStorage.setItem("fovHorizontal", FOV_HORIZONTAL);
            localStorage.setItem("fovVertical", FOV_VERTICAL);


            dibujarCielo();

        }
    );

}


// =====================================================
// CALIBRAR HORIZONTE
// =====================================================
// El usuario sostiene el móvil apuntando al horizonte real
// y pulsa este botón: guardamos el beta de ese instante como
// el "cero" a partir del cual se mide la elevación.

function calibrarHorizonte() {

    if (ultimoBetaCrudo === null) {

        alert(
            "Activa primero los sensores y mueve el móvil un poco."
        );

        return;

    }


    referenciaBeta =
        ultimoBetaCrudo;


    console.log(
        "📐 Horizonte calibrado con beta =",
        referenciaBeta
    );

}


const botonCalibrar =
    document.getElementById("calibrar");


if (botonCalibrar) {

    botonCalibrar.addEventListener(
        "click",
        calibrarHorizonte
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
// MODO AR / MODO LIBRE
// =====================================================

const botonModo =
    document.getElementById("modoBoton");


function cambiarModo() {

    modo =
        modo === "ar" ? "libre" : "ar";


    document.body.classList.toggle(
        "modo-libre",
        modo === "libre"
    );


    if (botonModo) {

        botonModo.textContent =
            modo === "ar" ?
                "Modo mapa libre" :
                "Modo cámara (AR)";

    }


    dibujarCielo();

}


if (botonModo) {

    botonModo.addEventListener(
        "click",
        cambiarModo
    );

}


// =====================================================
// ARRASTRE (rotar la vista en modo libre)
// =====================================================

let arrastrando = false;
let arrastreInicioX = 0;
let arrastreInicioY = 0;
let headingAlIniciar = 0;
let pitchAlIniciar = 0;


function iniciarArrastre(clientX, clientY) {

    if (modo !== "libre") {
        return;
    }

    arrastrando = true;

    arrastreInicioX = clientX;
    arrastreInicioY = clientY;

    headingAlIniciar = heading;
    pitchAlIniciar = pitch;

}


function moverArrastre(clientX, clientY) {

    if (!arrastrando || modo !== "libre") {
        return;
    }


    const deltaX =
        clientX - arrastreInicioX;

    const deltaY =
        clientY - arrastreInicioY;


    // Grados por pixel, calculado con el FOV actual,
    // para que arrastrar se sienta 1:1 con lo que ves en pantalla.

    const gradosPorPixelX =
        FOV_HORIZONTAL / window.innerWidth;

    const gradosPorPixelY =
        FOV_VERTICAL / window.innerHeight;


    heading =
        ((headingAlIniciar - deltaX * gradosPorPixelX) % 360 + 360) % 360;

    pitch =
        Math.max(
            -85,
            Math.min(
                85,
                pitchAlIniciar - deltaY * gradosPorPixelY
            )
        );


    direccionElemento.textContent =
        heading.toFixed(1) + "°";

    altitudElemento.textContent =
        pitch.toFixed(1) + "°";


    dibujarCielo();

}


function terminarArrastre() {

    arrastrando = false;

}


canvas.addEventListener(
    "pointerdown",
    evento => iniciarArrastre(evento.clientX, evento.clientY)
);

canvas.addEventListener(
    "pointermove",
    evento => moverArrastre(evento.clientX, evento.clientY)
);

window.addEventListener("pointerup", terminarArrastre);
window.addEventListener("pointercancel", terminarArrastre);


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


    // Base de la cámara y distancia focal, calculadas UNA vez
    // por frame y reutilizadas por estrellas y constelaciones.

    const base =
        baseCamara(heading, pitch);

    const focalH =
        centroX / Math.tan((FOV_HORIZONTAL * Math.PI / 180) / 2);

    const focalV =
        centroY / Math.tan((FOV_VERTICAL * Math.PI / 180) / 2);


    // =================================================
    // CONSTELACIONES (debajo de las estrellas)
    // =================================================

    if (constelaciones.length > 0) {

        dibujarConstelaciones(
            lst,
            base,
            focalH,
            focalV,
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


        const p =
            proyectarPunto(
                ra,
                dec,
                lst,
                base,
                focalH,
                focalV,
                centroX,
                centroY
            );


        if (!p) {
            continue;
        }


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
            p.x,
            p.y,
            radio,
            0,
            Math.PI * 2
        );


        ctx.fillStyle =
            `rgba(255,255,255,${brillo})`;


        ctx.fill();

    }


    // =================================================
    // SOL, LUNA Y PLANETAS (encima de todo lo demás)
    // =================================================

    ctx.textAlign = "center";
    ctx.font = "13px Arial, sans-serif";


    for (const cuerpo of cuerpos) {

        const p =
            proyectarAltAz(
                cuerpo.azimut,
                cuerpo.altitud,
                base,
                focalH,
                focalV,
                centroX,
                centroY
            );


        if (!p) {
            continue;
        }


        const radio =
            cuerpo.esLuna ? 14 : 6;

        const color =
            cuerpo.esLuna ? "#e8e8e0" : "#ffd27f";


        // Disco del cuerpo

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            radio,
            0,
            Math.PI * 2
        );

        ctx.fillStyle = color;

        ctx.fill();


        // Nombre encima

        ctx.fillStyle = "rgba(255,255,255,0.9)";

        ctx.fillText(
            cuerpo.nombre,
            p.x,
            p.y - radio - 6
        );

    }


    ctx.textAlign = "left";

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

    const errorCamaraElemento =
        document.getElementById("errorCamara");


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


        if (errorCamaraElemento) {

            errorCamaraElemento.textContent =
                `No se pudo iniciar la cámara. ` +
                `Tipo: ${error.name}. ` +
                `Revisa el permiso de cámara del sitio en los ajustes del navegador.`;

            errorCamaraElemento.style.display =
                "block";

        }

    }

}


// =====================================================
// INICIO
// =====================================================

escribir();

iniciarCamara();