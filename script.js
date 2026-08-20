const $ = id => document.getElementById(id);

const canvas = $("cieloCamara");
const ctx = canvas.getContext("2d");

const UI = {
    mensaje: $("ubicacionMensaje"),
    ubicacion: $("ubicacionUsuario"),
    pantalla: $("ubicacionDiv"),
    direccion: $("direccion"),
    altitud: $("altitud"),
    debug: $("debug"),
    camara: $("camara"),
    error: $("errorCamara"),
    activar: $("activar"),
    calibrar: $("calibrar"),
    modo: $("modoBoton"),
    fov: $("fovSlider"),
    fovTexto: $("fovValor")
};

// =====================================================
// ESTADO
// =====================================================

let lat;
let lon;

let estrellas = [];
let constelaciones = [];
let cuerpos = [];

let modo = "ar";

// Valores mostrados en UI
let heading = 0;
let pitch = 0;
let roll = 0;

let ultimoBeta = null;
let betaReferencia = null;

let fovH = Number(localStorage.getItem("fovH")) || 66;
let fovV = 50;

let renderPendiente = false;
let arrastrando = false;

let inicioX = 0;
let inicioY = 0;

let inicioHeading = 0;
let inicioPitch = 0;

// Sensores
let sensoresActivados = false;

// =====================================================
// CÁMARA 3D
// =====================================================
//
// En lugar de transformar:
//
// alpha -> heading
// beta  -> pitch
// gamma -> roll
//
// usamos un cuaternión completo.
//
// Esto evita el problema de gimbal lock cuando
// apuntamos cerca del cenit.
// =====================================================

const camara3D = {

    // Base de cámara en coordenadas del mundo
    forward: {
        x: 0,
        y: 1,
        z: 0
    },

    right: {
        x: 1,
        y: 0,
        z: 0
    },

    up: {
        x: 0,
        y: 0,
        z: 1
    },

    // Offset de calibración
    calibrada: false,

    offsetHeading: 0,

    // Para suavizado
    ultimoForward: null,
    ultimoRight: null,
    ultimoUp: null
};

// =====================================================
// UTILIDADES
// =====================================================

const rad = x => x * Math.PI / 180;
const deg = x => x * 180 / Math.PI;

const normalizar = x =>
    ((x % 360) + 360) % 360;

function limitar(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

function diferenciaAngular(a, b) {
    return ((a - b + 540) % 360) - 180;
}

function suavizarAngulo(actual, nuevo, factor) {
    return normalizar(
        actual +
        diferenciaAngular(nuevo, actual) * factor
    );
}

// =====================================================
// VECTORES
// =====================================================

function vector(az, alt) {

    az = rad(az);
    alt = rad(alt);

    return {
        x: Math.cos(alt) * Math.sin(az),
        y: Math.cos(alt) * Math.cos(az),
        z: Math.sin(alt)
    };
}

function dot(a, b) {

    return (
        a.x * b.x +
        a.y * b.y +
        a.z * b.z
    );
}

function cross(a, b) {

    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function unit(v) {

    const n =
        Math.hypot(v.x, v.y, v.z) || 1;

    return {
        x: v.x / n,
        y: v.y / n,
        z: v.z / n
    };
}

function sumar(a, b) {

    return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z
    };
}

function multiplicar(v, n) {

    return {
        x: v.x * n,
        y: v.y * n,
        z: v.z * n
    };
}

// =====================================================
// CUATERNIONES
// =====================================================

function quat(x, y, z, w) {

    return { x, y, z, w };
}

function quatNormalizar(q) {

    const n = Math.hypot(
        q.x,
        q.y,
        q.z,
        q.w
    ) || 1;

    return {
        x: q.x / n,
        y: q.y / n,
        z: q.z / n,
        w: q.w / n
    };
}

function quatMultiplicar(a, b) {

    return {
        w:
            a.w * b.w -
            a.x * b.x -
            a.y * b.y -
            a.z * b.z,

        x:
            a.w * b.x +
            a.x * b.w +
            a.y * b.z -
            a.z * b.y,

        y:
            a.w * b.y -
            a.x * b.z +
            a.y * b.w +
            a.z * b.x,

        z:
            a.w * b.z +
            a.x * b.y -
            a.y * b.x +
            a.z * b.w
    };
}

function quatConjugado(q) {

    return {
        x: -q.x,
        y: -q.y,
        z: -q.z,
        w: q.w
    };
}

function rotarVectorQuat(v, q) {

    const vq = {
        x: v.x,
        y: v.y,
        z: v.z,
        w: 0
    };

    const resultado =
        quatMultiplicar(
            quatMultiplicar(
                q,
                vq
            ),
            quatConjugado(q)
        );

    return {
        x: resultado.x,
        y: resultado.y,
        z: resultado.z
    };
}

// =====================================================
// EULER DEVICE ORIENTATION -> QUATERNION
// =====================================================

function quaternionDesdeSensor(alpha, beta, gamma) {

    const a = rad(alpha);
    const b = rad(beta);
    const g = rad(gamma);

    /*
     * DeviceOrientation usa:
     *
     * alpha = rotación Z
     * beta  = rotación X
     * gamma = rotación Y
     *
     * Orden equivalente YXZ.
     */

    const c1 = Math.cos(a / 2);
    const s1 = Math.sin(a / 2);

    const c2 = Math.cos(b / 2);
    const s2 = Math.sin(b / 2);

    const c3 = Math.cos(g / 2);
    const s3 = Math.sin(g / 2);

    let q = {

        x:
            s2 * c1 * c3 +
            c2 * s1 * s3,

        y:
            c2 * s1 * c3 -
            s2 * c1 * s3,

        z:
            c2 * c1 * s3 -
            s2 * s1 * c3,

        w:
            c2 * c1 * c3 +
            s2 * s1 * s3
    };

    q = quatNormalizar(q);

    /*
     * Corrección para que la cámara mire hacia
     * delante de la pantalla.
     */

    const correccionPantalla = quat(
        -Math.sqrt(0.5),
        0,
        0,
        Math.sqrt(0.5)
    );

    q = quatMultiplicar(
        q,
        correccionPantalla
    );

    // Rotación según orientación de pantalla
    let screenAngle = 0;

    try {

        screenAngle =
            screen.orientation?.angle || 0;

    } catch (e) {

        screenAngle = 0;
    }

    if (screenAngle !== 0) {

        const sr = rad(screenAngle);

        const screenQ = quat(
            0,
            0,
            -Math.sin(sr / 2),
            Math.cos(sr / 2)
        );

        q = quatMultiplicar(
            q,
            screenQ
        );
    }

    return quatNormalizar(q);
}

// =====================================================
// ORIENTACIÓN DE CÁMARA DESDE SENSOR
// =====================================================

function actualizarCamaraDesdeSensor(
    alpha,
    beta,
    gamma
) {

    const q =
        quaternionDesdeSensor(
            alpha,
            beta,
            gamma
        );

    /*
     * Coordenadas locales de la cámara:
     *
     * delante = -Z
     * derecha = +X
     * arriba  = +Y
     */

    let forward =
        rotarVectorQuat(
            {
                x: 0,
                y: 0,
                z: -1
            },
            q
        );

    let right =
        rotarVectorQuat(
            {
                x: 1,
                y: 0,
                z: 0
            },
            q
        );

    let up =
        rotarVectorQuat(
            {
                x: 0,
                y: 1,
                z: 0
            },
            q
        );

    forward = unit(forward);
    right = unit(right);
    up = unit(up);

    /*
     * Calibración horizontal.
     *
     * No modificamos el eje vertical.
     * Solamente giramos toda la cámara alrededor
     * del eje Z para alinearla con el norte.
     */

    if (camara3D.calibrada) {

        const angulo = rad(
            camara3D.offsetHeading
        );

        const c = Math.cos(angulo);
        const s = Math.sin(angulo);

        function rotZ(v) {

            return {
                x: v.x * c - v.y * s,
                y: v.x * s + v.y * c,
                z: v.z
            };
        }

        forward = unit(rotZ(forward));
        right = unit(rotZ(right));
        up = unit(rotZ(up));
    }

    /*
     * Suavizado vectorial.
     *
     * Esto es importante:
     * suavizamos los vectores y NO los ángulos.
     *
     * Así no existe el problema de que 359°
     * pase a 0° y provoque una vuelta completa.
     */

    const factor = 0.18;

    if (camara3D.ultimoForward) {

        forward = unit(
            sumar(
                multiplicar(
                    camara3D.ultimoForward,
                    1 - factor
                ),
                multiplicar(
                    forward,
                    factor
                )
            )
        );

        right = unit(
            sumar(
                multiplicar(
                    camara3D.ultimoRight,
                    1 - factor
                ),
                multiplicar(
                    right,
                    factor
                )
            )
        );

        up = unit(
            sumar(
                multiplicar(
                    camara3D.ultimoUp,
                    1 - factor
                ),
                multiplicar(
                    up,
                    factor
                )
            )
        );
    }

    camara3D.forward = forward;
    camara3D.right = right;
    camara3D.up = up;

    camara3D.ultimoForward = forward;
    camara3D.ultimoRight = right;
    camara3D.ultimoUp = up;

    /*
     * Datos visuales para la interfaz.
     *
     * Estos valores son solamente informativos.
     * YA NO se utilizan para dibujar la cámara.
     */

    const horizontal =
        Math.hypot(
            forward.x,
            forward.y
        );

    if (horizontal > 0.0001) {

        heading =
            normalizar(
                deg(
                    Math.atan2(
                        forward.x,
                        forward.y
                    )
                )
            );
    }

    pitch =
        deg(
            Math.asin(
                limitar(
                    forward.z,
                    -1,
                    1
                )
            )
        );

    /*
     * Roll calculado respecto al horizonte.
     */

    const horizonteRight = {
        x: Math.cos(rad(heading)),
        y: -Math.sin(rad(heading)),
        z: 0
    };

    const rollDot =
        limitar(
            dot(
                right,
                horizonteRight
            ),
            -1,
            1
        );

    roll =
        deg(
            Math.acos(
                rollDot
            )
        );

    if (up.z < 0) {
        roll = -roll;
    }

    UI.direccion.textContent =
        `${heading.toFixed(1)}°`;

    UI.altitud.textContent =
        `${pitch.toFixed(1)}°`;

    UI.debug.textContent =
        `α:${alpha.toFixed(0)} ` +
        `β:${beta.toFixed(0)} ` +
        `γ:${gamma.toFixed(0)}`;
}

// =====================================================
// RENDER
// =====================================================

function render() {

    if (renderPendiente) {
        return;
    }

    renderPendiente = true;

    requestAnimationFrame(() => {

        renderPendiente = false;

        dibujarCielo();
    });
}

// =====================================================
// UBICACIÓN
// =====================================================

function obtenerUbicacion() {

    if (!navigator.geolocation) {

        mostrarUbicacionError(
            "Geolocalización no disponible."
        );

        return;
    }

    navigator.geolocation.getCurrentPosition(

        async ({ coords }) => {

            lat = coords.latitude;
            lon = coords.longitude;

            UI.ubicacion.textContent =
                await obtenerCiudad(
                    lat,
                    lon
                );

            try {

                const resultados =
                    await Promise.all([
                        cargar("estrellas.json"),
                        cargar("constelaciones.json")
                    ]);

                estrellas = resultados[0];
                constelaciones = resultados[1];

            } catch (error) {

                console.error(
                    "Error cargando los archivos JSON:",
                    error
                );
            }

            actualizarPlanetas();

            render();

            setInterval(
                actualizarPlanetas,
                30000
            );

            setTimeout(() => {

                UI.pantalla?.remove();

            }, 2500);
        },

        error => {

            mostrarUbicacionError(
                `Error ${error.code}: ${error.message}`
            );
        },

        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

async function obtenerCiudad(lat, lon) {

    try {

        const url =
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

        const respuesta =
            await fetch(url);

        if (!respuesta.ok) {

            throw new Error(
                "Error en Nominatim"
            );
        }

        const datos =
            await respuesta.json();

        const address =
            datos.address || {};

        const ciudad =
            address.city ||
            address.town ||
            address.village ||
            address.municipality ||
            address.county ||
            "Ubicación desconocida";

        return `${ciudad}, ${address.country || ""}`;

    } catch (error) {

        console.error(
            "No se pudo obtener la ciudad:",
            error
        );

        return "Ubicación obtenida";
    }
}

function mostrarUbicacionError(texto) {

    UI.mensaje.textContent =
        "No se pudo obtener tu ubicación";

    UI.ubicacion.textContent =
        texto;

    setTimeout(() => {

        UI.pantalla?.remove();

    }, 2500);
}

// =====================================================
// JSON
// =====================================================

async function cargar(archivo) {

    const respuesta =
        await fetch(archivo);

    if (!respuesta.ok) {

        throw new Error(
            `No se pudo cargar ${archivo}`
        );
    }

    return await respuesta.json();
}

// =====================================================
// RA / DEC
// =====================================================

function raGrados(ra) {

    if (typeof ra !== "string") {
        return null;
    }

    const p =
        ra.match(
            /(\d+)h\s*(\d+)m\s*([\d.]+)s/i
        );

    if (!p) {
        return null;
    }

    return (
        Number(p[1]) +
        Number(p[2]) / 60 +
        Number(p[3]) / 3600
    ) * 15;
}

function decGrados(dec) {

    if (typeof dec !== "string") {
        return null;
    }

    const p =
        dec.match(
            /([+-])\s*(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/u
        );

    if (!p) {
        return null;
    }

    const signo =
        p[1] === "-" ? -1 : 1;

    return signo * (
        Number(p[2]) +
        Number(p[3]) / 60 +
        Number(p[4]) / 3600
    );
}

// =====================================================
// TIEMPO SIDERAL
// =====================================================

function tiempoSideral() {

    const jd =
        Date.now() / 86400000 +
        2440587.5;

    const T =
        (jd - 2451545.0) / 36525;

    let gmst =
        280.46061837 +
        360.98564736629 *
        (jd - 2451545.0) +
        0.000387933 *
        T *
        T -
        T *
        T *
        T /
        38710000;

    return normalizar(
        gmst + lon
    );
}

// =====================================================
// RA / DEC -> ALT / AZ
// =====================================================

function altAz(ra, dec, lst) {

    let H =
        normalizar(lst - ra);

    if (H > 180) {
        H -= 360;
    }

    const L = rad(lat);
    const D = rad(dec);
    const h = rad(H);

    const alt =
        Math.asin(
            limitar(
                Math.sin(L) *
                Math.sin(D) +

                Math.cos(L) *
                Math.cos(D) *
                Math.cos(h),

                -1,
                1
            )
        );

    const az =
        Math.atan2(
            Math.sin(h),

            Math.cos(h) *
            Math.sin(L) -

            Math.tan(D) *
            Math.cos(L)
        );

    return {

        az:
            normalizar(
                deg(az) + 180
            ),

        alt:
            deg(alt)
    };
}

// =====================================================
// BASE DE CÁMARA
// =====================================================

function baseCamara() {

    /*
     * MODO AR:
     * usar directamente la orientación 3D
     * procedente del sensor.
     */

    if (modo === "ar") {

        return {

            forward: camara3D.forward,
            right: camara3D.right,
            up: camara3D.up
        };
    }

    /*
     * MODO LIBRE
     */

    const forward =
        vector(
            heading,
            pitch
        );

    let right =
        unit(
            cross(
                forward,
                {
                    x: 0,
                    y: 0,
                    z: 1
                }
            )
        );

    if (
        Math.hypot(
            right.x,
            right.y
        ) < 0.0001
    ) {

        right =
            unit(
                cross(
                    forward,
                    {
                        x: 1,
                        y: 0,
                        z: 0
                    }
                )
            );
    }

    let up =
        unit(
            cross(
                right,
                forward
            )
        );

    const r = rad(roll);

    if (roll !== 0) {

        const oldRight = {
            ...right
        };

        const oldUp = {
            ...up
        };

        right = {

            x:
                oldRight.x *
                Math.cos(r) +

                oldUp.x *
                Math.sin(r),

            y:
                oldRight.y *
                Math.cos(r) +

                oldUp.y *
                Math.sin(r),

            z:
                oldRight.z *
                Math.cos(r) +

                oldUp.z *
                Math.sin(r)
        };

        up = {

            x:
                -oldRight.x *
                Math.sin(r) +

                oldUp.x *
                Math.cos(r),

            y:
                -oldRight.y *
                Math.sin(r) +

                oldUp.y *
                Math.cos(r),

            z:
                -oldRight.z *
                Math.sin(r) +

                oldUp.z *
                Math.cos(r)
        };
    }

    return {
        forward,
        right,
        up
    };
}

// =====================================================
// PROYECCIÓN
// =====================================================

function proyectar(
    az,
    alt,
    base,
    fx,
    fy,
    cx,
    cy
) {

    const p =
        vector(
            az,
            alt
        );

    const frente =
        dot(
            p,
            base.forward
        );

    if (frente <= 0.001) {
        return null;
    }

    const x =
        cx +
        fx *
        dot(
            p,
            base.right
        ) /
        frente;

    const y =
        cy -
        fy *
        dot(
            p,
            base.up
        ) /
        frente;

    const margen = 100;

    if (
        x < -margen ||
        x > innerWidth + margen ||
        y < -margen ||
        y > innerHeight + margen
    ) {

        return null;
    }

    return {
        x,
        y
    };
}

// =====================================================
// PLANETAS
// =====================================================

const planetas = [

    ["Sun", "Sol"],
    ["Moon", "Luna"],
    ["Mercury", "Mercurio"],
    ["Venus", "Venus"],
    ["Mars", "Marte"],
    ["Jupiter", "Júpiter"],
    ["Saturn", "Saturno"]

];

function actualizarPlanetas() {

    if (
        lat === undefined ||
        lon === undefined ||
        typeof Astronomy === "undefined"
    ) {
        return;
    }

    const ahora =
        new Date();

    const observador =
        new Astronomy.Observer(
            lat,
            lon,
            0
        );

    cuerpos =
        planetas

            .map(
                ([body, nombre]) => {

                    try {

                        const e =
                            Astronomy.Equator(
                                Astronomy.Body[body],
                                ahora,
                                observador,
                                true,
                                true
                            );

                        const h =
                            Astronomy.Horizon(
                                ahora,
                                observador,
                                e.ra,
                                e.dec,
                                "normal"
                            );

                        return {

                            nombre,

                            az:
                                h.azimuth,

                            alt:
                                h.altitude
                        };

                    } catch (error) {

                        console.error(
                            `Error calculando ${nombre}:`,
                            error
                        );

                        return null;
                    }
                }
            )
            .filter(Boolean);

    render();
}

// =====================================================
// ESTRELLAS
// =====================================================

function dibujarEstrellas(
    lst,
    base,
    fx,
    fy,
    cx,
    cy
) {

    for (const estrella of estrellas) {

        const ra =
            raGrados(
                estrella.RA
            );

        const dec =
            decGrados(
                estrella.Dec
            );

        if (
            ra === null ||
            dec === null
        ) {
            continue;
        }

        const h =
            altAz(
                ra,
                dec,
                lst
            );

        const p =
            proyectar(
                h.az,
                h.alt,
                base,
                fx,
                fy,
                cx,
                cy
            );

        if (!p) {
            continue;
        }

        const mag =
            Number(
                estrella.V
            );

        if (!Number.isFinite(mag)) {
            continue;
        }

        const radio =
            limitar(
                3.8 -
                mag * 0.45,
                0.5,
                5
            );

        const brillo =
            limitar(
                1.2 -
                mag / 8,
                0.15,
                1
            );

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
}

// =====================================================
// CONSTELACIONES
// =====================================================

function dibujarConstelaciones(
    lst,
    base,
    fx,
    fy,
    cx,
    cy
) {

    ctx.strokeStyle =
        "rgba(120,170,255,.55)";

    ctx.lineWidth = 1;

    ctx.font =
        "13px Arial";

    ctx.fillStyle =
        "rgba(180,210,255,.75)";

    for (const c of constelaciones) {

        let nombrePunto = null;

        for (
            const linea of c.lineas || []
        ) {

            ctx.beginPath();

            let dibujado = false;

            for (
                let i = 0;
                i < linea.length - 1;
                i++
            ) {

                const p1 =
                    linea[i];

                const p2 =
                    linea[i + 1];

                const h1 =
                    altAz(
                        p1[0],
                        p1[1],
                        lst
                    );

                const h2 =
                    altAz(
                        p2[0],
                        p2[1],
                        lst
                    );

                const a =
                    proyectar(
                        h1.az,
                        h1.alt,
                        base,
                        fx,
                        fy,
                        cx,
                        cy
                    );

                const b =
                    proyectar(
                        h2.az,
                        h2.alt,
                        base,
                        fx,
                        fy,
                        cx,
                        cy
                    );

                if (!a || !b) {
                    continue;
                }

                ctx.moveTo(
                    a.x,
                    a.y
                );

                ctx.lineTo(
                    b.x,
                    b.y
                );

                if (!nombrePunto) {
                    nombrePunto = a;
                }

                dibujado = true;
            }

            if (dibujado) {
                ctx.stroke();
            }
        }

        if (nombrePunto) {

            ctx.fillText(
                c.nombre || "",
                nombrePunto.x + 6,
                nombrePunto.y - 6
            );
        }
    }
}

// =====================================================
// CUERPOS CELESTES
// =====================================================

function dibujarCuerpos(
    base,
    fx,
    fy,
    cx,
    cy
) {

    ctx.textAlign =
        "center";

    ctx.font =
        "13px Arial";

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

    for (const cuerpo of cuerpos) {

        const p =
            proyectar(
                cuerpo.az,
                cuerpo.alt,
                base,
                fx,
                fy,
                cx,
                cy
            );

        if (!p) {
            continue;
        }

        const radio =
            tamaños[cuerpo.nombre] || 5;

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            radio,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            colores[cuerpo.nombre] ||
            "#ffd27f";

        ctx.fill();

        ctx.fillStyle =
            "rgba(255,255,255,.9)";

        ctx.fillText(
            cuerpo.nombre,
            p.x,
            p.y - radio - 6
        );
    }

    ctx.textAlign =
        "left";
}

// =====================================================
// DIBUJAR TODO
// =====================================================

function dibujarCielo() {

    if (
        lat === undefined ||
        lon === undefined
    ) {
        return;
    }

    const w =
        innerWidth;

    const h =
        innerHeight;

    const cx =
        w / 2;

    const cy =
        h / 2;

    ctx.clearRect(
        0,
        0,
        w,
        h
    );

    const base =
        baseCamara();

    const lst =
        tiempoSideral();

    const fx =
        cx /
        Math.tan(
            rad(fovH) / 2
        );

    const fy =
        cy /
        Math.tan(
            rad(fovV) / 2
        );

    if (constelaciones.length) {

        dibujarConstelaciones(
            lst,
            base,
            fx,
            fy,
            cx,
            cy
        );
    }

    dibujarEstrellas(
        lst,
        base,
        fx,
        fy,
        cx,
        cy
    );

    dibujarCuerpos(
        base,
        fx,
        fy,
        cx,
        cy
    );
}

// =====================================================
// SENSORES
// =====================================================

function activarSensores() {

    if (sensoresActivados) {
        return;
    }

    sensoresActivados = true;

    window.addEventListener(
        "deviceorientation",
        e => {

            if (modo !== "ar") {
                return;
            }

            const alpha =
                e.alpha;

            const beta =
                e.beta;

            const gamma =
                e.gamma;

            if (
                alpha === null ||
                beta === null ||
                gamma === null
            ) {
                return;
            }

            ultimoBeta =
                beta;

            actualizarCamaraDesdeSensor(
                alpha,
                beta,
                gamma
            );

            render();
        },
        true
    );
}

// =====================================================
// CALIBRACIÓN
// =====================================================

function calibrar() {

    if (ultimoBeta === null) {

        alert(
            "Activa los sensores primero."
        );

        return;
    }

    /*
     * Queremos que la dirección actual de la cámara
     * se convierta en el punto que estamos mirando.
     *
     * Para el mapa celeste necesitamos conservar
     * el horizonte, así que calculamos solamente
     * la diferencia horizontal.
     */

    const f =
        camara3D.forward;

    const headingActual =
        normalizar(
            deg(
                Math.atan2(
                    f.x,
                    f.y
                )
            )
        );

    /*
     * Si existe brújula del dispositivo,
     * la usamos como referencia norte.
     */

    const elemento =
        window.__ultimoDeviceOrientationEvent;

    if (
        elemento &&
        typeof elemento.webkitCompassHeading ===
        "number"
    ) {

        const brujula =
            normalizar(
                elemento.webkitCompassHeading
            );

        camara3D.offsetHeading =
            brujula -
            headingActual;

    } else {

        /*
         * Sin brújula:
         * mantenemos la dirección actual como referencia.
         */

        camara3D.offsetHeading =
            -headingActual;
    }

    camara3D.calibrada =
        true;

    /*
     * Reiniciar suavizado para evitar un salto.
     */

    camara3D.ultimoForward = null;
    camara3D.ultimoRight = null;
    camara3D.ultimoUp = null;

    pitch = 0;

    UI.altitud.textContent =
        "0°";

    render();
}

// =====================================================
// FOV
// =====================================================

function actualizarFOV() {

    if (!innerWidth) {
        return;
    }

    fovV =
        2 *
        deg(
            Math.atan(
                Math.tan(
                    rad(fovH) / 2
                ) *
                innerHeight /
                innerWidth
            )
        );
}

if (UI.fov) {

    UI.fov.value =
        fovH;

    actualizarFOV();

    UI.fov.addEventListener(
        "input",
        () => {

            fovH =
                Number(
                    UI.fov.value
                );

            localStorage.setItem(
                "fovH",
                fovH
            );

            actualizarFOV();

            UI.fovTexto.textContent =
                `${fovH}°`;

            render();
        }
    );
}

if (UI.fovTexto) {

    UI.fovTexto.textContent =
        `${fovH}°`;
}

// =====================================================
// MODO LIBRE
// =====================================================

function cambiarModo() {

    modo =
        modo === "ar"
            ? "libre"
            : "ar";

    document.body.classList.toggle(
        "modo-libre",
        modo === "libre"
    );

    UI.modo.textContent =
        modo === "ar"
            ? "Modo mapa libre"
            : "Modo cámara (AR)";

    render();
}

// =====================================================
// ARRASTRE
// =====================================================

canvas.addEventListener(
    "pointerdown",
    e => {

        if (modo !== "libre") {
            return;
        }

        arrastrando = true;

        inicioX =
            e.clientX;

        inicioY =
            e.clientY;

        inicioHeading =
            heading;

        inicioPitch =
            pitch;

        canvas.setPointerCapture?.(
            e.pointerId
        );
    }
);

canvas.addEventListener(
    "pointermove",
    e => {

        if (!arrastrando) {
            return;
        }

        const dx =
            e.clientX -
            inicioX;

        const dy =
            e.clientY -
            inicioY;

        heading =
            normalizar(
                inicioHeading -
                dx *
                fovH /
                innerWidth
            );

        pitch =
            limitar(
                inicioPitch -
                dy *
                fovV /
                innerHeight,
                -89,
                89
            );

        UI.direccion.textContent =
            `${heading.toFixed(1)}°`;

        UI.altitud.textContent =
            `${pitch.toFixed(1)}°`;

        render();
    }
);

window.addEventListener(
    "pointerup",
    () => {

        arrastrando = false;
    }
);

// =====================================================
// CÁMARA
// =====================================================

async function iniciarCamara() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        UI.error.textContent =
            "La cámara no está disponible en este navegador.";

        UI.error.style.display =
            "block";

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

        UI.camara.srcObject =
            stream;

        UI.camara.play?.();

    } catch (e) {

        console.error(
            "Error de cámara:",
            e
        );

        UI.error.textContent =
            `No se pudo iniciar la cámara: ${e.name}`;

        UI.error.style.display =
            "block";
    }
}

// =====================================================
// GUARDAR ÚLTIMO EVENTO DE ORIENTACIÓN
// =====================================================

window.addEventListener(
    "deviceorientation",
    e => {

        window.__ultimoDeviceOrientationEvent =
            e;
    },
    true
);

// =====================================================
// EVENTOS
// =====================================================

if (UI.activar) {

    UI.activar.addEventListener(
        "click",
        async () => {

            try {

                if (
                    typeof DeviceOrientationEvent !==
                    "undefined" &&

                    typeof DeviceOrientationEvent.requestPermission ===
                    "function"
                ) {

                    const permiso =
                        await DeviceOrientationEvent
                            .requestPermission();

                    if (
                        permiso !==
                        "granted"
                    ) {

                        UI.debug.textContent =
                            "Permiso de sensores denegado.";

                        return;
                    }
                }

                activarSensores();

                UI.activar.textContent =
                    "Sensores activados";

            } catch (e) {

                console.error(e);

                UI.debug.textContent =
                    "No se pudieron activar los sensores.";
            }
        }
    );
}

if (UI.calibrar) {

    UI.calibrar.addEventListener(
        "click",
        calibrar
    );
}

if (UI.modo) {

    UI.modo.addEventListener(
        "click",
        cambiarModo
    );
}

// =====================================================
// RESIZE / CANVAS
// =====================================================

function ajustarCanvas() {

    const dpr =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        innerWidth * dpr;

    canvas.height =
        innerHeight * dpr;

    canvas.style.width =
        `${innerWidth}px`;

    canvas.style.height =
        `${innerHeight}px`;

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    actualizarFOV();

    render();
}

window.addEventListener(
    "resize",
    ajustarCanvas
);

// =====================================================
// INICIO
// =====================================================

function escribir() {

    const texto =
        "Tu ubicación es";

    let i = 0;

    UI.mensaje.textContent =
        "";

    const timer =
        setInterval(
            () => {

                if (
                    i >= texto.length
                ) {

                    clearInterval(
                        timer
                    );

                    obtenerUbicacion();

                    return;
                }

                UI.mensaje.textContent +=
                    texto[i++];

            },
            60
        );
}

// =====================================================
// ARRANQUE
// =====================================================

ajustarCanvas();

escribir();

iniciarCamara();