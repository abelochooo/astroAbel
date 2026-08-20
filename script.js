const canvas = document.getElementById("cieloCamara");
const ctx = canvas.getContext("2d");

const mensaje = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const pantallaInicio = document.getElementById("ubicacionDiv");
const direccionTexto = document.getElementById("direccion");
const alturaTexto = document.getElementById("altitud");
const debug = document.getElementById("debug");
const camara = document.getElementById("camara");
const errorCamara = document.getElementById("errorCamara");

const botonSensores = document.getElementById("activar");
const botonCalibrar = document.getElementById("calibrar");
const botonModo = document.getElementById("modoBoton");
const botonBuscar = document.getElementById("buscarObjeto");

const sliderFov = document.getElementById("fovSlider");
const textoFov = document.getElementById("fovValor");

let latitud;
let longitud;

let estrellas = [];
let constelaciones = [];
let planetas = [];

let modo = "ar";

let direccion = 0;
let altura = 0;
let inclinacion = 0;

let ultimaBeta = null;
let referenciaBeta = null;

let sensoresEncendidos = false;

let campoVision = Number(localStorage.getItem("fovH")) || 66;
let campoVisionVertical = 50;

let moviendo = false;
let inicioX = 0;
let inicioY = 0;
let inicioDireccion = 0;
let inicioAltura = 0;

let objetoBuscado = null;

const aRadianes = numero => numero * Math.PI / 180;
const aGrados = numero => numero * 180 / Math.PI;

function normalizar(numero) {
    return ((numero % 360) + 360) % 360;
}

function limitar(numero, minimo, maximo) {
    return Math.max(minimo, Math.min(maximo, numero));
}

function diferenciaAngulo(a, b) {
    return ((a - b + 540) % 360) - 180;
}

function moverSuave(actual, nuevo, velocidad) {
    return normalizar(
        actual + diferenciaAngulo(nuevo, actual) * velocidad
    );
}

function actualizarPantalla() {
    requestAnimationFrame(() => {
        dibujarCielo();
    });
}

async function cargarArchivo(nombre) {
    const respuesta = await fetch(nombre);

    if (!respuesta.ok) {
        throw new Error("No se pudo cargar " + nombre);
    }

    return await respuesta.json();
}

async function buscarCiudad(lat, lon) {
    try {
        const url =
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

        const respuesta = await fetch(url);

        if (!respuesta.ok) {
            throw new Error("No se encontró la ciudad");
        }

        const datos = await respuesta.json();
        const direccion = datos.address || {};

        const ciudad =
            direccion.city ||
            direccion.town ||
            direccion.village ||
            direccion.municipality ||
            direccion.county ||
            "Ubicación desconocida";

        return `${ciudad}, ${direccion.country || ""}`;

    } catch (error) {
        console.error(error);
        return "Ubicación obtenida";
    }
}

function conseguirUbicacion() {
    if (!navigator.geolocation) {
        ubicacion.textContent = "La ubicación no está disponible.";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async posicion => {

            latitud = posicion.coords.latitude;
            longitud = posicion.coords.longitude;

            ubicacion.textContent =
                await buscarCiudad(latitud, longitud);

            try {
                const datos = await Promise.all([
                    cargarArchivo("estrellas.json"),
                    cargarArchivo("constelaciones.json")
                ]);

                estrellas = datos[0];
                constelaciones = datos[1];

            } catch (error) {
                console.error("Error cargando los archivos:", error);
            }

            calcularPlanetas();

            setInterval(calcularPlanetas, 30000);

            actualizarPantalla();

            setTimeout(() => {
                pantallaInicio?.remove();
            }, 2500);

        },

        error => {

            mensaje.textContent = "No se pudo obtener tu ubicación";

            ubicacion.textContent =
                `Error ${error.code}: ${error.message}`;

            setTimeout(() => {
                pantallaInicio?.remove();
            }, 2500);
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function convertirRA(ra) {
    if (typeof ra !== "string") return null;

    const partes = ra.match(
        /(\d+)h\s*(\d+)m\s*([\d.]+)s/i
    );

    if (!partes) return null;

    return (
        Number(partes[1]) +
        Number(partes[2]) / 60 +
        Number(partes[3]) / 3600
    ) * 15;
}

function convertirDec(dec) {
    if (typeof dec !== "string") return null;

    const partes = dec.match(
        /([+-])\s*(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/u
    );

    if (!partes) return null;

    const signo = partes[1] === "-" ? -1 : 1;

    return signo * (
        Number(partes[2]) +
        Number(partes[3]) / 60 +
        Number(partes[4]) / 3600
    );
}

function tiempoSideral() {
    const fechaJuliana =
        Date.now() / 86400000 + 2440587.5;

    const siglos =
        (fechaJuliana - 2451545) / 36525;

    const hora =
        280.46061837 +
        360.98564736629 *
        (fechaJuliana - 2451545) +
        0.000387933 * siglos * siglos -
        siglos * siglos * siglos / 38710000;

    return normalizar(hora + longitud);
}

function calcularAltura(ra, dec, horaSideral) {
    let hora = normalizar(horaSideral - ra);

    if (hora > 180) {
        hora -= 360;
    }

    const lat = aRadianes(latitud);
    const declinacion = aRadianes(dec);
    const h = aRadianes(hora);

    const altura = Math.asin(
        limitar(
            Math.sin(lat) * Math.sin(declinacion) +
            Math.cos(lat) *
            Math.cos(declinacion) *
            Math.cos(h),
            -1,
            1
        )
    );

    const azimut = Math.atan2(
        Math.sin(h),
        Math.cos(h) * Math.sin(lat) -
        Math.tan(declinacion) * Math.cos(lat)
    );

    return {
        azimut: normalizar(aGrados(azimut) + 180),
        altura: aGrados(altura)
    };
}

function crearVector(azimut, altura) {
    const az = aRadianes(azimut);
    const alt = aRadianes(altura);

    return {
        x: Math.cos(alt) * Math.sin(az),
        y: Math.cos(alt) * Math.cos(az),
        z: Math.sin(alt)
    };
}

function productoPunto(a, b) {
    return (
        a.x * b.x +
        a.y * b.y +
        a.z * b.z
    );
}

function productoCruz(a, b) {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function normalizarVector(vector) {
    const tamaño =
        Math.hypot(
            vector.x,
            vector.y,
            vector.z
        ) || 1;

    return {
        x: vector.x / tamaño,
        y: vector.y / tamaño,
        z: vector.z / tamaño
    };
}

function crearCamara() {
    const haciaDondeMiro =
        crearVector(direccion, altura);

    let derecha = normalizarVector(
        productoCruz(
            haciaDondeMiro,
            {
                x: 0,
                y: 0,
                z: 1
            }
        )
    );

    if (
        Math.hypot(derecha.x, derecha.y) < 0.001
    ) {
        derecha = normalizarVector(
            productoCruz(
                haciaDondeMiro,
                {
                    x: 1,
                    y: 0,
                    z: 0
                }
            )
        );
    }

    const arriba = normalizarVector(
        productoCruz(
            derecha,
            haciaDondeMiro
        )
    );

    return {
        haciaDondeMiro,
        derecha,
        arriba
    };
}

function ponerEnPantalla(
    azimut,
    alturaObjeto,
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {
    const objeto = crearVector(
        azimut,
        alturaObjeto
    );

    const delante =
        productoPunto(
            objeto,
            camaraActual.haciaDondeMiro
        );

    if (delante <= 0.001) {
        return null;
    }

    const x =
        centroX +
        fx *
        productoPunto(
            objeto,
            camaraActual.derecha
        ) / delante;

    const y =
        centroY -
        fy *
        productoPunto(
            objeto,
            camaraActual.arriba
        ) / delante;

    const margen = 150;

    if (
        x < -margen ||
        x > innerWidth + margen ||
        y < -margen ||
        y > innerHeight + margen
    ) {
        return null;
    }

    return { x, y };
}

const listaPlanetas = [
    ["Sun", "Sol"],
    ["Moon", "Luna"],
    ["Mercury", "Mercurio"],
    ["Venus", "Venus"],
    ["Mars", "Marte"],
    ["Jupiter", "Júpiter"],
    ["Saturn", "Saturno"]
];

function calcularPlanetas() {
    if (
        latitud === undefined ||
        longitud === undefined ||
        typeof Astronomy === "undefined"
    ) {
        return;
    }

    const ahora = new Date();

    const observador =
        new Astronomy.Observer(
            latitud,
            longitud,
            0
        );

    planetas = listaPlanetas
        .map(([nombreIngles, nombre]) => {

            try {
                const posicion =
                    Astronomy.Equator(
                        Astronomy.Body[nombreIngles],
                        ahora,
                        observador,
                        true,
                        true
                    );

                const cielo =
                    Astronomy.Horizon(
                        ahora,
                        observador,
                        posicion.ra,
                        posicion.dec,
                        "normal"
                    );

                return {
                    nombre,
                    azimut: normalizar(cielo.azimuth),
                    altura: cielo.altitude
                };

            } catch (error) {
                console.error(error);
                return null;
            }
        })
        .filter(Boolean);

    if (objetoBuscado) {
        const nuevoObjeto =
            planetas.find(
                planeta =>
                    planeta.nombre === objetoBuscado.nombre
            );

        if (nuevoObjeto) {
            objetoBuscado = nuevoObjeto;
        }
    }

    actualizarPantalla();
}

function dibujarEstrellas(
    horaSideral,
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {
    for (const estrella of estrellas) {

        const ra = convertirRA(estrella.RA);
        const dec = convertirDec(estrella.Dec);

        if (ra === null || dec === null) {
            continue;
        }

        const posicion =
            calcularAltura(
                ra,
                dec,
                horaSideral
            );

        const punto =
            ponerEnPantalla(
                posicion.azimut,
                posicion.altura,
                camaraActual,
                fx,
                fy,
                centroX,
                centroY
            );

        if (!punto) continue;

        const magnitud = Number(estrella.V);

        if (!Number.isFinite(magnitud)) {
            continue;
        }

        const tamaño =
            limitar(
                3.8 - magnitud * 0.45,
                0.5,
                5
            );

        const brillo =
            limitar(
                1.2 - magnitud / 8,
                0.15,
                1
            );

        ctx.beginPath();

        ctx.arc(
            punto.x,
            punto.y,
            tamaño,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            `rgba(255,255,255,${brillo})`;

        ctx.fill();
    }
}

function dibujarConstelaciones(
    horaSideral,
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {
    ctx.strokeStyle = "rgba(120,170,255,.55)";
    ctx.lineWidth = 1;
    ctx.font = "13px Arial";
    ctx.fillStyle = "rgba(180,210,255,.75)";

    for (const constelacion of constelaciones) {

        let nombrePunto = null;

        for (
            const linea of constelacion.lineas || []
        ) {
            ctx.beginPath();

            let dibujado = false;

            for (
                let i = 0;
                i < linea.length - 1;
                i++
            ) {
                const punto1 = linea[i];
                const punto2 = linea[i + 1];

                const cielo1 =
                    calcularAltura(
                        punto1[0],
                        punto1[1],
                        horaSideral
                    );

                const cielo2 =
                    calcularAltura(
                        punto2[0],
                        punto2[1],
                        horaSideral
                    );

                const pantalla1 =
                    ponerEnPantalla(
                        cielo1.azimut,
                        cielo1.altura,
                        camaraActual,
                        fx,
                        fy,
                        centroX,
                        centroY
                    );

                const pantalla2 =
                    ponerEnPantalla(
                        cielo2.azimut,
                        cielo2.altura,
                        camaraActual,
                        fx,
                        fy,
                        centroX,
                        centroY
                    );

                if (!pantalla1 || !pantalla2) {
                    continue;
                }

                ctx.moveTo(
                    pantalla1.x,
                    pantalla1.y
                );

                ctx.lineTo(
                    pantalla2.x,
                    pantalla2.y
                );

                if (!nombrePunto) {
                    nombrePunto = pantalla1;
                }

                dibujado = true;
            }

            if (dibujado) {
                ctx.stroke();
            }
        }

        if (nombrePunto) {
            ctx.fillText(
                constelacion.nombre || "",
                nombrePunto.x + 6,
                nombrePunto.y - 6
            );
        }
    }
}

function dibujarPlanetas(
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {
    const tamaños = {
        Sol: 16,
        Luna: 13,
        Júpiter: 8,
        Saturno: 7,
        Venus: 6,
        Marte: 5,
        Mercurio: 4
    };

    const colores = {
        Sol: "#fff0a0",
        Luna: "#e8e8e0",
        Júpiter: "#e8c28c",
        Saturno: "#ead6a0",
        Venus: "#fff0b0",
        Marte: "#e77d52",
        Mercurio: "#bdb7a8"
    };

    ctx.textAlign = "center";
    ctx.font = "13px Arial";

    for (const planeta of planetas) {

        const punto =
            ponerEnPantalla(
                planeta.azimut,
                planeta.altura,
                camaraActual,
                fx,
                fy,
                centroX,
                centroY
            );

        if (!punto) continue;

        const tamaño =
            tamaños[planeta.nombre] || 5;

        ctx.beginPath();

        ctx.arc(
            punto.x,
            punto.y,
            tamaño,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            colores[planeta.nombre] || "#ffd27f";

        ctx.fill();

        ctx.fillStyle =
            "rgba(255,255,255,.9)";

        ctx.fillText(
            planeta.nombre,
            punto.x,
            punto.y - tamaño - 6
        );
    }

    ctx.textAlign = "left";
}

function dibujarObjetivo(
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {
    if (!objetoBuscado) {
        return;
    }

    const punto =
        ponerEnPantalla(
            objetoBuscado.azimut,
            objetoBuscado.altura,
            camaraActual,
            fx,
            fy,
            centroX,
            centroY
        );

    ctx.textAlign = "center";

    if (punto) {

        ctx.beginPath();

        ctx.arc(
            punto.x,
            punto.y,
            25,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle = "#00ff88";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 15px Arial";

        ctx.fillText(
            `🎯 ${objetoBuscado.nombre}`,
            punto.x,
            punto.y - 34
        );

    } else {

        const diferenciaHorizontal =
            diferenciaAngulo(
                objetoBuscado.azimut,
                direccion
            );

        const diferenciaVertical =
            objetoBuscado.altura - altura;

        ctx.fillStyle = "#00ff88";
        ctx.font = "bold 18px Arial";

        ctx.fillText(
            `${Math.abs(Math.round(diferenciaHorizontal))}° ` +
            `${diferenciaHorizontal > 0 ? "→" : "←"}   ` +
            `${Math.abs(Math.round(diferenciaVertical))}° ` +
            `${diferenciaVertical > 0 ? "↑" : "↓"}`,
            innerWidth / 2,
            innerHeight - 80
        );
    }

    ctx.textAlign = "left";
}

function dibujarCielo() {
    if (
        latitud === undefined ||
        longitud === undefined
    ) {
        return;
    }

    const ancho = innerWidth;
    const alto = innerHeight;

    const centroX = ancho / 2;
    const centroY = alto / 2;

    ctx.clearRect(
        0,
        0,
        ancho,
        alto
    );

    const camaraActual = crearCamara();
    const horaSideral = tiempoSideral();

    const fx =
        centroX /
        Math.tan(
            aRadianes(campoVision) / 2
        );

    const fy =
        centroY /
        Math.tan(
            aRadianes(campoVisionVertical) / 2
        );

    dibujarConstelaciones(
        horaSideral,
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );

    dibujarEstrellas(
        horaSideral,
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );

    dibujarPlanetas(
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );

    dibujarObjetivo(
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );
}

function activarSensores() {
    if (sensoresEncendidos) {
        return;
    }

    sensoresEncendidos = true;

    window.addEventListener(
        "deviceorientation",
        evento => {

            if (
                modo !== "ar" ||
                evento.beta === null ||
                evento.gamma === null
            ) {
                return;
            }

            ultimaBeta = evento.beta;

            let nuevaDireccion;

            if (
                typeof evento.webkitCompassHeading === "number"
            ) {
                nuevaDireccion =
                    normalizar(
                        evento.webkitCompassHeading
                    );

            } else if (
                evento.absolute &&
                evento.alpha !== null
            ) {
                nuevaDireccion =
                    normalizar(
                        360 - evento.alpha
                    );

            } else {
                return;
            }

            const referencia =
                referenciaBeta ?? 90;

            const nuevaAltura =
                limitar(
                    evento.beta - referencia,
                    -89,
                    89
                );

            const vertical =
                Math.abs(nuevaAltura);

            let suavizado = 0.15;

            if (vertical > 70) {
                suavizado = 0.02;
            } else if (vertical > 55) {
                suavizado = 0.05;
            } else if (vertical > 40) {
                suavizado = 0.10;
            }

            direccion =
                moverSuave(
                    direccion,
                    nuevaDireccion,
                    suavizado
                );

            altura +=
                (nuevaAltura - altura) * 0.12;

            inclinacion +=
                (
                    limitar(
                        evento.gamma,
                        -45,
                        45
                    ) - inclinacion
                ) * 0.08;

            direccionTexto.textContent =
                `${direccion.toFixed(1)}°`;

            alturaTexto.textContent =
                `${altura.toFixed(1)}°`;

            debug.textContent =
                `α:${Math.round(evento.alpha || 0)} ` +
                `β:${Math.round(evento.beta)} ` +
                `γ:${Math.round(evento.gamma)}`;

            actualizarPantalla();
        },
        true
    );
}

function calibrarSensores() {
    if (ultimaBeta === null) {
        alert("Activa los sensores primero.");
        return;
    }

    referenciaBeta = ultimaBeta;
    altura = 0;

    alturaTexto.textContent = "0°";

    actualizarPantalla();
}

function cambiarModo() {
    if (modo === "ar") {
        modo = "libre";
    } else {
        modo = "ar";
    }

    document.body.classList.toggle(
        "modo-libre",
        modo === "libre"
    );

    botonModo.textContent =
        modo === "ar"
            ? "Modo mapa libre"
            : "Modo cámara (AR)";

    actualizarPantalla();
}

function buscarObjeto() {
    if (!planetas.length) {
        alert(
            "Todavía estoy calculando los objetos del cielo."
        );
        return;
    }

    const nombres =
        planetas
            .map(planeta => planeta.nombre)
            .join("\n");

    const texto = prompt(
        `¿Qué quieres encontrar?\n\n${nombres}`
    );

    if (!texto) {
        return;
    }

    const buscado =
        texto
            .toLowerCase()
            .trim();

    const encontrado =
        planetas.find(
            planeta =>
                planeta.nombre
                    .toLowerCase() === buscado
        );

    if (!encontrado) {
        alert("No encuentro ese objeto.");
        return;
    }

    objetoBuscado = {
        ...encontrado
    };

    actualizarPantalla();
}

botonBuscar?.addEventListener(
    "click",
    buscarObjeto
);

canvas.addEventListener(
    "pointerdown",
    evento => {

        if (modo !== "libre") {
            return;
        }

        moviendo = true;

        inicioX = evento.clientX;
        inicioY = evento.clientY;

        inicioDireccion = direccion;
        inicioAltura = altura;

        canvas.setPointerCapture?.(
            evento.pointerId
        );
    }
);

canvas.addEventListener(
    "pointermove",
    evento => {

        if (!moviendo) {
            return;
        }

        const cambioX =
            evento.clientX - inicioX;

        const cambioY =
            evento.clientY - inicioY;

        direccion =
            normalizar(
                inicioDireccion -
                cambioX *
                campoVision /
                innerWidth
            );

        altura =
            limitar(
                inicioAltura -
                cambioY *
                campoVisionVertical /
                innerHeight,
                -85,
                85
            );

        direccionTexto.textContent =
            `${direccion.toFixed(1)}°`;

        alturaTexto.textContent =
            `${altura.toFixed(1)}°`;

        actualizarPantalla();
    }
);

window.addEventListener(
    "pointerup",
    () => {
        moviendo = false;
    }
);

async function iniciarCamara() {
    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {
        errorCamara.textContent =
            "La cámara no está disponible.";

        errorCamara.style.display = "block";
        return;
    }

    try {
        const stream =
            await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: {
                        ideal: "environment"
                    }
                },
                audio: false
            });

        camara.srcObject = stream;

        await camara.play?.();

    } catch (error) {

        console.error(error);

        errorCamara.textContent =
            `No se pudo iniciar la cámara: ${error.name}`;

        errorCamara.style.display = "block";
    }
}

botonSensores?.addEventListener(
    "click",
    async () => {

        try {

            if (
                typeof DeviceOrientationEvent !== "undefined" &&
                typeof DeviceOrientationEvent.requestPermission === "function"
            ) {
                const permiso =
                    await DeviceOrientationEvent.requestPermission();

                if (permiso !== "granted") {
                    debug.textContent =
                        "Permiso de sensores denegado.";
                    return;
                }
            }

            activarSensores();

            botonSensores.textContent =
                "Sensores activados";

        } catch (error) {

            console.error(error);

            debug.textContent =
                "No se pudieron activar los sensores.";
        }
    }
);

botonCalibrar?.addEventListener(
    "click",
    calibrarSensores
);

botonModo?.addEventListener(
    "click",
    cambiarModo
);

if (sliderFov) {

    sliderFov.value = campoVision;

    actualizarFOV();

    sliderFov.addEventListener(
        "input",
        () => {

            campoVision =
                Number(sliderFov.value);

            localStorage.setItem(
                "fovH",
                campoVision
            );

            actualizarFOV();

            if (textoFov) {
                textoFov.textContent =
                    `${campoVision}°`;
            }

            actualizarPantalla();
        }
    );
}

if (textoFov) {
    textoFov.textContent =
        `${campoVision}°`;
}

function actualizarFOV() {
    if (!innerWidth) {
        return;
    }

    campoVisionVertical =
        2 *
        aGrados(
            Math.atan(
                Math.tan(
                    aRadianes(campoVision) / 2
                ) *
                innerHeight /
                innerWidth
            )
        );
}

function ajustarCanvas() {
    const pixelRatio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        innerWidth * pixelRatio;

    canvas.height =
        innerHeight * pixelRatio;

    canvas.style.width =
        `${innerWidth}px`;

    canvas.style.height =
        `${innerHeight}px`;

    ctx.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );

    actualizarFOV();
    actualizarPantalla();
}

window.addEventListener(
    "resize",
    ajustarCanvas
);

function mostrarInicio() {

    const texto = "Tu ubicación es";

    let posicion = 0;

    mensaje.textContent = "";

    const escribir = setInterval(
        () => {

            if (posicion >= texto.length) {

                clearInterval(escribir);

                conseguirUbicacion();

                return;
            }

            mensaje.textContent +=
                texto[posicion];

            posicion++;

        },
        60
    );
}

ajustarCanvas();
mostrarInicio();
iniciarCamara();