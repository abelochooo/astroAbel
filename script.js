// =====================================================
// ELEMENTOS DEL DOM
// =====================================================
const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");

const canvas = document.getElementById("cieloCamara");
const ctx = canvas.getContext("2d");

const direccionElemento = document.getElementById("direccion");
const altitudElemento = document.getElementById("altitud");
const debugElemento = document.getElementById("debug");

// =====================================================
// ESTADO GLOBAL
// =====================================================
let latitud, longitud;
let estrellas = [];
let constelaciones = [];
let cuerpos = []; // sol, luna, planetas

// Orientación
let heading = 0;
let pitch = 0;
let headingInicializado = false;

const FACTOR_SUAVIZADO_HEADING = 0.15;
const FACTOR_SUAVIZADO_PITCH = 0.25;

// Calibración del horizonte (cada móvil da un "beta" distinto en reposo)
let referenciaBeta = null;
let ultimoBetaCrudo = null;

// Campo de visión (varía según el móvil, se ajusta con el slider y se recuerda)
const RELACION_FOV = 50 / 66;
let FOV_HORIZONTAL = Number(localStorage.getItem("fovHorizontal")) || 66;
let FOV_VERTICAL = Number(localStorage.getItem("fovVertical")) || 50;

// "ar" = cámara real + sensores | "libre" = arrastrar con el dedo/ratón
let modo = "ar";

// Arrastre (modo libre)
let arrastrando = false;
let arrastreInicioX = 0;
let arrastreInicioY = 0;
let headingAlIniciar = 0;
let pitchAlIniciar = 0;

const CUERPOS_A_MOSTRAR = [
    { body: "Sun", nombre: "Sol" },
    { body: "Moon", nombre: "Luna" },
    { body: "Mercury", nombre: "Mercurio" },
    { body: "Venus", nombre: "Venus" },
    { body: "Mars", nombre: "Marte" },
    { body: "Jupiter", nombre: "Júpiter" },
    { body: "Saturn", nombre: "Saturno" }
];

// =====================================================
// EFECTO DE ESCRITURA INICIAL
// =====================================================
function escribir() {
    const texto = "Tu ubicación es";
    let i = 0;

    const intervalo = setInterval(() => {
        if (i >= texto.length) {
            clearInterval(intervalo);
            obtenerUbicacion();
            return;
        }
        texto1.textContent += texto[i];
        i++;
    }, 100);
}

// =====================================================
// UBICACIÓN
// =====================================================
async function obtenerUbicacion() {
    navigator.geolocation.getCurrentPosition(
        onUbicacionOk,
        onUbicacionError,
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

async function onUbicacionOk({ coords }) {
    latitud = coords.latitude;
    longitud = coords.longitude;

    ubicacion.textContent = await obtenerNombreCiudad(latitud, longitud);

    cargarEstrellas();
    cargarConstelaciones();

    actualizarCuerposCelestes();
    setInterval(actualizarCuerposCelestes, 30000);

    setTimeout(() => ubicacionDiv?.remove(), 3000);
}

function onUbicacionError(error) {
    console.error("Error de ubicación:", error);

    if (texto1) texto1.textContent = "No se pudo obtener tu ubicación";
    if (ubicacion) ubicacion.textContent = `Código de error: ${error.code} - ${error.message}`;

    setTimeout(() => ubicacionDiv?.remove(), 3000);
}

async function obtenerNombreCiudad(lat, lon) {
    try {
        const respuesta = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`
        );
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);

        const { address } = await respuesta.json();
        const ciudad = address.city || address.town || address.village || address.municipality || "Ubicación desconocida";

        return `${ciudad}, ${address.country}`;
    } catch (error) {
        console.error("Error obteniendo ciudad:", error);
        return "Ubicación obtenida";
    }
}

// =====================================================
// CARGA DE DATOS (estrellas / constelaciones)
// =====================================================
async function cargarJSON(archivo) {
    const respuesta = await fetch(archivo);
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return respuesta.json();
}

async function cargarEstrellas() {
    try {
        estrellas = await cargarJSON("estrellas.json");
        console.log("⭐ Estrellas cargadas:", estrellas.length);
        redimensionarCanvas();
        dibujarCielo();
    } catch (error) {
        console.error("Error cargando estrellas:", error);
    }
}

async function cargarConstelaciones() {
    try {
        constelaciones = await cargarJSON("constelaciones.json");
        console.log("✨ Constelaciones cargadas:", constelaciones.length);
        dibujarCielo();
    } catch (error) {
        console.error("Error cargando constelaciones:", error);
    }
}

// =====================================================
// CONVERSIÓN DE COORDENADAS (RA / Dec en texto → grados)
// =====================================================
function raAGrados(ra) {
    const partes = ra?.match(/(\d+)h\s*(\d+)m\s*([\d.]+)s/);
    if (!partes) return null;

    const [, horas, minutos, segundos] = partes.map(Number);
    return (horas + minutos / 60 + segundos / 3600) * 15;
}

function decAGrados(dec) {
    const patron = /([+-])(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/;
    const partes = dec?.match(/([+-])(\d+)°\s*(\d+)′\s*(\d+(?:\.\d+)?)″/) || dec?.match(patron);
    if (!partes) return null;

    const signo = partes[1] === "-" ? -1 : 1;
    const [, , grados, minutos, segundos] = partes.map(Number);

    return signo * (grados + minutos / 60 + segundos / 3600);
}

// =====================================================
// TIEMPO SIDERAL Y POSICIÓN EN EL CIELO
// =====================================================
function tiempoSideral() {
    if (latitud === undefined || longitud === undefined) return 0;

    const jd = Date.now() / 86400000 + 2440587.5;
    const T = (jd - 2451545.0) / 36525;

    let gmst = 280.46061837 + 360.98564736629 * (jd - 2451545.0)
        + 0.000387933 * T * T - (T * T * T) / 38710000;

    gmst = ((gmst % 360) + 360) % 360;

    return ((gmst + longitud) % 360 + 360) % 360;
}

function estrellaAltAz(ra, dec, lst) {
    let H = ((lst - ra + 180) % 360 + 360) % 360 - 180;

    const lat = latitud * Math.PI / 180;
    const decl = dec * Math.PI / 180;
    const hora = H * Math.PI / 180;

    const sinAlt = Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.cos(hora);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt)));

    const az = Math.atan2(
        Math.sin(hora),
        Math.cos(hora) * Math.sin(lat) - Math.tan(decl) * Math.cos(lat)
    );

    const azDeg = ((az * 180 / Math.PI + 180) % 360 + 360) % 360;

    return { azimut: azDeg, altitud: alt * 180 / Math.PI };
}

// =====================================================
// VECTORES 3D (proyección gnomónica: x=este, y=norte, z=cenit)
// =====================================================
function azAltAVector(azimutDeg, altitudDeg) {
    const az = azimutDeg * Math.PI / 180;
    const alt = altitudDeg * Math.PI / 180;
    const cosAlt = Math.cos(alt);

    return { x: cosAlt * Math.sin(az), y: cosAlt * Math.cos(az), z: Math.sin(alt) };
}

const producto = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

const cruz = (a, b) => ({
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x
});

function normalizar(v) {
    const longitud = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    return { x: v.x / longitud, y: v.y / longitud, z: v.z / longitud };
}

// Base ortonormal de la cámara (hacia dónde mira, su derecha y su arriba)
function baseCamara(headingDeg, pitchDeg) {
    const forward = azAltAVector(headingDeg, pitchDeg);
    let right = normalizar(cruz(forward, { x: 0, y: 0, z: 1 }));

    // Caso degenerado: mirando casi al cenit/nadir, usamos otro eje de referencia
    const esDegenerado = !isFinite(right.x)
        || (Math.abs(right.x) < 1e-9 && Math.abs(right.y) < 1e-9 && Math.abs(right.z) < 1e-9);

    if (esDegenerado) right = normalizar(cruz(forward, { x: 1, y: 0, z: 0 }));

    const up = cruz(right, forward);
    return { forward, right, up };
}

// =====================================================
// PROYECCIÓN EN PANTALLA
// =====================================================
function proyectarPunto(ra, dec, lst, base, focalH, focalV, centroX, centroY) {
    const { azimut, altitud } = estrellaAltAz(ra, dec, lst);
    return proyectarAltAz(azimut, altitud, base, focalH, focalV, centroX, centroY);
}

function proyectarAltAz(azimut, altitud, base, focalH, focalV, centroX, centroY) {
    if (altitud <= 0) return null;

    const punto = azAltAVector(azimut, altitud);
    const pf = producto(punto, base.forward);

    if (pf <= 0.01) return null; // detrás de la cámara

    const px = producto(punto, base.right);
    const py = producto(punto, base.up);

    const x = centroX + focalH * (px / pf);
    const y = centroY - focalV * (py / pf);

    const fueraDePantalla = x < -100 || x > centroX * 2 + 100 || y < -100 || y > centroY * 2 + 100;
    if (fueraDePantalla) return null;

    return { x, y };
}

// =====================================================
// SOL, LUNA Y PLANETAS
// =====================================================
function actualizarCuerposCelestes() {
    if (latitud === undefined || longitud === undefined || typeof Astronomy === "undefined") return;

    const ahora = new Date();
    const observador = new Astronomy.Observer(latitud, longitud, 0);

    cuerpos = CUERPOS_A_MOSTRAR.map(({ body, nombre }) => {
        try {
            const ecuatorial = Astronomy.Equator(Astronomy.Body[body], ahora, observador, true, true);
            const horizonte = Astronomy.Horizon(ahora, observador, ecuatorial.ra, ecuatorial.dec, "normal");

            return {
                nombre,
                esLuna: nombre === "Luna",
                azimut: horizonte.azimuth,
                altitud: horizonte.altitude
            };
        } catch (error) {
            console.error("Error calculando posición de " + nombre, error);
            return null;
        }
    }).filter(Boolean);

    dibujarCielo();
}

// =====================================================
// DIBUJO
// =====================================================
function dibujarConstelaciones(lst, base, focalH, focalV, centroX, centroY) {
    ctx.strokeStyle = "rgba(120, 170, 255, 0.55)";
    ctx.lineWidth = 1;

    for (const constelacion of constelaciones) {
        let puntoParaNombre = null;

        for (const linea of constelacion.lineas) {
            ctx.beginPath();
            let hayTrazo = false;

            for (let i = 0; i < linea.length - 1; i++) {
                const [ra1, dec1] = linea[i];
                const [ra2, dec2] = linea[i + 1];

                const p1 = proyectarPunto(ra1, dec1, lst, base, focalH, focalV, centroX, centroY);
                const p2 = proyectarPunto(ra2, dec2, lst, base, focalH, focalV, centroX, centroY);

                // Solo se dibuja el segmento si ambos extremos están en cámara
                if (p1 && p2) {
                    ctx.moveTo(p1.x, p1.y);
                    ctx.lineTo(p2.x, p2.y);
                    hayTrazo = true;
                    puntoParaNombre ??= p1;
                }
            }

            if (hayTrazo) ctx.stroke();
        }

        if (puntoParaNombre) {
            ctx.font = "13px Arial, sans-serif";
            ctx.fillStyle = "rgba(180, 210, 255, 0.75)";
            ctx.fillText(constelacion.nombre, puntoParaNombre.x + 6, puntoParaNombre.y - 6);
        }
    }
}

function dibujarEstrellas(lst, base, focalH, focalV, centroX, centroY) {
    for (const estrella of estrellas) {
        if (!estrella.RA || !estrella.Dec) continue;

        const ra = raAGrados(estrella.RA);
        const dec = decAGrados(estrella.Dec);
        if (ra === null || dec === null) continue;

        const p = proyectarPunto(ra, dec, lst, base, focalH, focalV, centroX, centroY);
        if (!p) continue;

        const magnitud = Number(estrella.V);
        if (Number.isNaN(magnitud)) continue;

        const radio = Math.max(0.6, Math.min(5, 3.8 - magnitud * 0.45));
        const brillo = Math.max(0.15, Math.min(1, 1.2 - magnitud / 8));

        ctx.beginPath();
        ctx.arc(p.x, p.y, radio, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${brillo})`;
        ctx.fill();
    }
}

function dibujarCuerposCelestes(base, focalH, focalV, centroX, centroY) {
    ctx.textAlign = "center";
    ctx.font = "13px Arial, sans-serif";

    for (const cuerpo of cuerpos) {
        const p = proyectarAltAz(cuerpo.azimut, cuerpo.altitud, base, focalH, focalV, centroX, centroY);
        if (!p) continue;

        const radio = cuerpo.esLuna ? 14 : 6;
        const color = cuerpo.esLuna ? "#e8e8e0" : "#ffd27f";

        ctx.beginPath();
        ctx.arc(p.x, p.y, radio, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.fillText(cuerpo.nombre, p.x, p.y - radio - 6);
    }

    ctx.textAlign = "left";
}

function dibujarCielo() {
    if (latitud === undefined || longitud === undefined || estrellas.length === 0) return;

    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    const centroX = ancho / 2;
    const centroY = alto / 2;

    // Solo limpiamos: el fondo es el vídeo de la cámara (o el degradado en modo libre)
    ctx.clearRect(0, 0, ancho, alto);

    const lst = tiempoSideral();
    const base = baseCamara(heading, pitch);
    const focalH = centroX / Math.tan((FOV_HORIZONTAL * Math.PI / 180) / 2);
    const focalV = centroY / Math.tan((FOV_VERTICAL * Math.PI / 180) / 2);

    if (constelaciones.length > 0) dibujarConstelaciones(lst, base, focalH, focalV, centroX, centroY);
    dibujarEstrellas(lst, base, focalH, focalV, centroX, centroY);
    dibujarCuerposCelestes(base, focalH, focalV, centroX, centroY);
}

// =====================================================
// SENSORES DE ORIENTACIÓN
// =====================================================
function activarSensores() {
    let ultimaActualizacion = 0;

    window.addEventListener("deviceorientation", evento => {
        if (modo !== "ar") return;

        const ahora = Date.now();
        if (ahora - ultimaActualizacion < 30) return;
        ultimaActualizacion = ahora;

        if (debugElemento) {
            debugElemento.textContent =
                `alpha: ${evento.alpha?.toFixed(1)} | beta: ${evento.beta?.toFixed(1)} | gamma: ${evento.gamma?.toFixed(1)}`;
        }

        actualizarHeading(evento);
        actualizarPitch(evento);
        dibujarCielo();
    }, true);
}

function actualizarHeading(evento) {
    // iPhone/iPad dan compás directo; Android (y otros) dan alpha
    const nuevoHeading = typeof evento.webkitCompassHeading === "number"
        ? evento.webkitCompassHeading
        : typeof evento.alpha === "number" ? 360 - evento.alpha : null;

    if (nuevoHeading === null || Number.isNaN(nuevoHeading)) return;

    const headingNormalizado = (nuevoHeading + 360) % 360;

    if (!headingInicializado) {
        heading = headingNormalizado;
        headingInicializado = true;
    } else {
        // Diferencia más corta, contemplando el salto 360°→0°
        let diferencia = headingNormalizado - heading;
        diferencia = ((diferencia + 180) % 360 + 360) % 360 - 180;

        // Cerca del cenit el sensor se pone ruidoso: se refuerza el suavizado ahí
        const cercaniaAlCenit = Math.min(1, Math.abs(pitch) / 90);
        const factorHeadingActual = FACTOR_SUAVIZADO_HEADING * (1 - cercaniaAlCenit * 0.85);

        heading = (heading + diferencia * factorHeadingActual + 360) % 360;
    }

    direccionElemento.textContent = heading.toFixed(1) + "°";
}

function actualizarPitch(evento) {
    if (typeof evento.beta !== "number" || Number.isNaN(evento.beta)) return;

    ultimoBetaCrudo = evento.beta;

    // Hasta calibrar, se usa 90 como referencia provisional
    const referencia = referenciaBeta ?? 90;
    let pitchCrudo = evento.beta - referencia;

    // Cerca de ±90° la brújula del móvil se vuelve inestable (limitación física del sensor)
    pitchCrudo = Math.max(-89, Math.min(89, pitchCrudo));

    pitch += (pitchCrudo - pitch) * FACTOR_SUAVIZADO_PITCH;

    altitudElemento.textContent = pitch.toFixed(1) + "°" + (referenciaBeta === null ? " (sin calibrar)" : "");
}

function calibrarHorizonte() {
    if (ultimoBetaCrudo === null) {
        alert("Activa primero los sensores y mueve el móvil un poco.");
        return;
    }

    referenciaBeta = ultimoBetaCrudo;
    console.log("📐 Horizonte calibrado con beta =", referenciaBeta);
}

// =====================================================
// FOV (ZOOM)
// =====================================================
function inicializarControlFOV() {
    const fovSlider = document.getElementById("fovSlider");
    const fovValorTexto = document.getElementById("fovValor");
    if (!fovSlider) return;

    fovSlider.value = FOV_HORIZONTAL;
    if (fovValorTexto) fovValorTexto.textContent = FOV_HORIZONTAL + "°";

    fovSlider.addEventListener("input", () => {
        FOV_HORIZONTAL = Number(fovSlider.value);
        FOV_VERTICAL = Math.round(FOV_HORIZONTAL * RELACION_FOV);

        if (fovValorTexto) fovValorTexto.textContent = FOV_HORIZONTAL + "°";

        localStorage.setItem("fovHorizontal", FOV_HORIZONTAL);
        localStorage.setItem("fovVertical", FOV_VERTICAL);

        dibujarCielo();
    });
}

// =====================================================
// MODO AR / MODO LIBRE
// =====================================================
function cambiarModo() {
    modo = modo === "ar" ? "libre" : "ar";
    document.body.classList.toggle("modo-libre", modo === "libre");

    const botonModo = document.getElementById("modoBoton");
    if (botonModo) botonModo.textContent = modo === "ar" ? "Modo mapa libre" : "Modo cámara (AR)";

    dibujarCielo();
}

// =====================================================
// ARRASTRE (rotar la vista en modo libre)
// =====================================================
function iniciarArrastre(clientX, clientY) {
    if (modo !== "libre") return;

    arrastrando = true;
    arrastreInicioX = clientX;
    arrastreInicioY = clientY;
    headingAlIniciar = heading;
    pitchAlIniciar = pitch;
}

function moverArrastre(clientX, clientY) {
    if (!arrastrando || modo !== "libre") return;

    const deltaX = clientX - arrastreInicioX;
    const deltaY = clientY - arrastreInicioY;

    // Grados por pixel según el FOV actual, para que se sienta 1:1 con la pantalla
    const gradosPorPixelX = FOV_HORIZONTAL / window.innerWidth;
    const gradosPorPixelY = FOV_VERTICAL / window.innerHeight;

    heading = ((headingAlIniciar - deltaX * gradosPorPixelX) % 360 + 360) % 360;
    pitch = Math.max(-85, Math.min(85, pitchAlIniciar - deltaY * gradosPorPixelY));

    direccionElemento.textContent = heading.toFixed(1) + "°";
    altitudElemento.textContent = pitch.toFixed(1) + "°";

    dibujarCielo();
}

function terminarArrastre() {
    arrastrando = false;
}

// =====================================================
// CANVAS Y CÁMARA
// =====================================================
function redimensionarCanvas() {
    const escala = window.devicePixelRatio || 1;

    canvas.width = window.innerWidth * escala;
    canvas.height = window.innerHeight * escala;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";

    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    dibujarCielo();
}

async function iniciarCamara() {
    const errorCamaraElemento = document.getElementById("errorCamara");

    try {
        const transmision = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        });

        document.getElementById("camara").srcObject = transmision;
    } catch (error) {
        console.error("Error al iniciar la cámara:", error);

        if (errorCamaraElemento) {
            errorCamaraElemento.textContent =
                `No se pudo iniciar la cámara. Tipo: ${error.name}. ` +
                `Revisa el permiso de cámara del sitio en los ajustes del navegador.`;
            errorCamaraElemento.style.display = "block";
        }
    }
}

// =====================================================
// EVENTOS Y ARRANQUE
// =====================================================
function inicializarEventos() {
    document.getElementById("activar").addEventListener("click", async () => {
        try {
            const necesitaPermiso = typeof DeviceOrientationEvent !== "undefined"
                && typeof DeviceOrientationEvent.requestPermission === "function";

            if (necesitaPermiso) {
                const permiso = await DeviceOrientationEvent.requestPermission();
                if (permiso !== "granted") return;
            }

            activarSensores();
            document.getElementById("activar").textContent = "Sensores activados";
        } catch (error) {
            console.error("Error activando sensores:", error);
        }
    });

    document.getElementById("calibrar")?.addEventListener("click", calibrarHorizonte);
    document.getElementById("modoBoton")?.addEventListener("click", cambiarModo);

    canvas.addEventListener("pointerdown", e => iniciarArrastre(e.clientX, e.clientY));
    canvas.addEventListener("pointermove", e => moverArrastre(e.clientX, e.clientY));
    window.addEventListener("pointerup", terminarArrastre);
    window.addEventListener("pointercancel", terminarArrastre);

    window.addEventListener("resize", redimensionarCanvas);
}

inicializarControlFOV();
inicializarEventos();
escribir();
iniciarCamara();