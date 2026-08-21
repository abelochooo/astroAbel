import { estado } from "./state.js";

// ============================================================
// UTILIDADES
// ============================================================

function radianes(grados) {
    return grados * Math.PI / 180;
}

function grados(radianes) {
    return radianes * 180 / Math.PI;
}

function normalizarVector(v) {
    const longitud = Math.hypot(v.x, v.y, v.z);

    if (longitud < 0.000001) {
        return { x: 0, y: 0, z: 0 };
    }

    return {
        x: v.x / longitud,
        y: v.y / longitud,
        z: v.z / longitud
    };
}

function productoCruz(a, b) {
    return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
    };
}

function productoPunto(a, b) {
    return (
        a.x * b.x +
        a.y * b.y +
        a.z * b.z
    );
}

// ============================================================
// PANTALLA
// ============================================================

function obtenerAnguloPantalla() {
    if (
        screen.orientation &&
        typeof screen.orientation.angle === "number"
    ) {
        return screen.orientation.angle;
    }

    if (typeof window.orientation === "number") {
        return window.orientation;
    }

    return 0;
}

// ============================================================
// ORIENTACIÓN IPHONE
//
// Sistema mundo:
// X = Este
// Y = Norte
// Z = Arriba
//
// Cámara trasera:
// mira hacia fuera de la pantalla.
//
// En iPhone usamos:
// heading = norte magnético/geográfico proporcionado
// por webkitCompassHeading.
//
// beta  = inclinación delante/detrás
// gamma = inclinación izquierda/derecha
// ============================================================

function crearOrientacionDesdeSensores(
    headingGrados,
    betaGrados,
    gammaGrados
) {
    const heading = radianes(headingGrados);
    const beta = radianes(betaGrados);
    const gamma = radianes(gammaGrados);

    // --------------------------------------------------------
    // Dirección horizontal hacia la que apunta el teléfono.
    //
    // heading:
    //   0   = Norte
    //   90  = Este
    //   180 = Sur
    //   270 = Oeste
    // --------------------------------------------------------

    let haciaDondeMiro = {
        x: Math.sin(heading),
        y: Math.cos(heading),
        z: 0
    };

    // --------------------------------------------------------
    // Inclinación vertical.
    //
    // beta/gamma producen la inclinación de la cámara.
    //
    // No usamos alpha aquí.
    // --------------------------------------------------------

    const inclinacion =
        radianes(90 - Math.abs(beta));

    haciaDondeMiro.z =
        Math.sin(inclinacion);

    // --------------------------------------------------------
    // Reconstruimos la componente horizontal.
    // --------------------------------------------------------

    const horizontal =
        Math.cos(inclinacion);

    haciaDondeMiro.x *= horizontal;
    haciaDondeMiro.y *= horizontal;

    haciaDondeMiro =
        normalizarVector(haciaDondeMiro);

    // --------------------------------------------------------
    // Eje derecha.
    //
    // Cruz entre dirección y vertical terrestre.
    // --------------------------------------------------------

    const norteArriba = {
        x: 0,
        y: 0,
        z: 1
    };

    let derecha =
        productoCruz(
            haciaDondeMiro,
            norteArriba
        );

    derecha =
        normalizarVector(derecha);

    // --------------------------------------------------------
    // Eje arriba de la pantalla.
    // --------------------------------------------------------

    let arriba =
        productoCruz(
            derecha,
            haciaDondeMiro
        );

    arriba =
        normalizarVector(arriba);

    // --------------------------------------------------------
    // Corrección de orientación física de pantalla.
    // --------------------------------------------------------

    const pantalla =
        obtenerAnguloPantalla();

    if (Math.abs(pantalla) > 0.001) {
        const angulo =
            radianes(-pantalla);

        const c = Math.cos(angulo);
        const s = Math.sin(angulo);

        const derechaOriginal = { ...derecha };
        const arribaOriginal = { ...arriba };

        derecha = {
            x:
                derechaOriginal.x * c -
                arribaOriginal.x * s,

            y:
                derechaOriginal.y * c -
                arribaOriginal.y * s,

            z:
                derechaOriginal.z * c -
                arribaOriginal.z * s
        };

        arriba = {
            x:
                derechaOriginal.x * s +
                arribaOriginal.x * c,

            y:
                derechaOriginal.y * s +
                arribaOriginal.y * c,

            z:
                derechaOriginal.z * s +
                arribaOriginal.z * c
        };
    }

    return {
        haciaDondeMiro,
        derecha,
        arriba
    };
}

// ============================================================
// ACTUALIZAR ESTADO
// ============================================================

export function actualizarOrientacion(
    heading,
    beta,
    gamma,
    absoluta = false
) {
    if (
        !Number.isFinite(heading) ||
        !Number.isFinite(beta) ||
        !Number.isFinite(gamma)
    ) {
        return false;
    }

    const orientacion =
        crearOrientacionDesdeSensores(
            heading,
            beta,
            gamma
        );

    estado.orientacion = {
        haciaDondeMiro:
            orientacion.haciaDondeMiro,

        derecha:
            orientacion.derecha,

        arriba:
            orientacion.arriba,

        disponible: true,
        absoluta
    };

    const vector =
        orientacion.haciaDondeMiro;

    let azimut =
        grados(
            Math.atan2(
                vector.x,
                vector.y
            )
        );

    azimut =
        (azimut + 360) % 360;

    const altura =
        grados(
            Math.asin(
                Math.max(
                    -1,
                    Math.min(
                        1,
                        vector.z
                    )
                )
            )
        );

    estado.direccion = azimut;
    estado.altura = altura;
    estado.inclinacion = beta;

    return true;
}

// ============================================================
// REINICIAR
// ============================================================

export function reiniciarOrientacion() {
    estado.orientacion = {
        haciaDondeMiro: {
            x: 0,
            y: 1,
            z: 0
        },

        derecha: {
            x: 1,
            y: 0,
            z: 0
        },

        arriba: {
            x: 0,
            y: 0,
            z: 1
        },

        disponible: false,
        absoluta: false
    };
}