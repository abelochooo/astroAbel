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
        return {
            x: 0,
            y: 0,
            z: 0
        };
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

    if (
        typeof window.orientation === "number"
    ) {
        return window.orientation;
    }

    return 0;
}

// ============================================================
// ROTACIÓN DEVICE ORIENTATION
//
// DeviceOrientation:
//
// alpha -> Z
// beta  -> X'
// gamma -> Y''
//
// La especificación define:
//
// R = Rz(alpha) * Rx(beta) * Ry(gamma)
//
// En iPhone NO usamos alpha para el rumbo.
// Convertimos:
//
// alpha = -webkitCompassHeading
//
// porque alpha aumenta en sentido contrario
// al heading de brújula.
//
// Mundo:
//
// X = Este
// Y = Norte
// Z = Arriba
//
// Teléfono:
//
// X = derecha
// Y = arriba
// Z = fuera de pantalla
//
// Cámara trasera = -Z
// ============================================================

function transformarVector(
    vector,
    alpha,
    beta,
    gamma
) {
    const ca = Math.cos(alpha);
    const sa = Math.sin(alpha);

    const cb = Math.cos(beta);
    const sb = Math.sin(beta);

    const cg = Math.cos(gamma);
    const sg = Math.sin(gamma);

    // R = Rz(alpha) * Rx(beta) * Ry(gamma)

    const x =
        (ca * cg - sa * sb * sg) * vector.x +
        (-ca * sb * sg - sa * cg) * vector.y +
        (ca * sg - sa * sb * cg) * vector.z;

    const y =
        (sa * cg + ca * sb * sg) * vector.x +
        (-sa * sb * sg + ca * cg) * vector.y +
        (sa * sg + ca * sb * cg) * vector.z;

    const z =
        (-cb * sg) * vector.x +
        (sb) * vector.y +
        (cb * cg) * vector.z;

    return {
        x,
        y,
        z
    };
}

// ============================================================
// ORIENTACIÓN
// ============================================================

export function calcularOrientacion(
    headingGrados,
    betaGrados,
    gammaGrados
) {
    /*
     * iPhone:
     *
     * heading:
     *   0   = Norte
     *   90  = Este
     *   180 = Sur
     *   270 = Oeste
     *
     * DeviceOrientation alpha tiene el sentido contrario
     * al heading de brújula.
     */

    const alpha =
        radianes(
            -headingGrados
        );

    const beta =
        radianes(
            betaGrados
        );

    const gamma =
        radianes(
            gammaGrados
        );

    // --------------------------------------------------------
    // CÁMARA TRASERA
    //
    // La cámara mira hacia fuera de la pantalla = -Z
    // --------------------------------------------------------

    const camaraLocal = {
        x: 0,
        y: 0,
        z: -1
    };

    let haciaDondeMiro =
        transformarVector(
            camaraLocal,
            alpha,
            beta,
            gamma
        );

    // --------------------------------------------------------
    // EJES DE PANTALLA
    // --------------------------------------------------------

    let derecha =
        transformarVector(
            {
                x: 1,
                y: 0,
                z: 0
            },
            alpha,
            beta,
            gamma
        );

    let arriba =
        transformarVector(
            {
                x: 0,
                y: 1,
                z: 0
            },
            alpha,
            beta,
            gamma
        );

    // --------------------------------------------------------
    // CORRECCIÓN DE ORIENTACIÓN DE PANTALLA
    //
    // Rotamos derecha/arriba alrededor del eje de visión.
    // La dirección del cielo NO cambia al rotar la interfaz.
    // --------------------------------------------------------

    const orientacionPantalla =
        radianes(
            obtenerAnguloPantalla()
        );

    if (
        Math.abs(orientacionPantalla) >
        0.000001
    ) {
        const c =
            Math.cos(
                orientacionPantalla
            );

        const s =
            Math.sin(
                orientacionPantalla
            );

        const derechaOriginal = {
            ...derecha
        };

        const arribaOriginal = {
            ...arriba
        };

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

    // --------------------------------------------------------
    // NORMALIZACIÓN
    // --------------------------------------------------------

    haciaDondeMiro =
        normalizarVector(
            haciaDondeMiro
        );

    derecha =
        normalizarVector(
            derecha
        );

    arriba =
        normalizarVector(
            arriba
        );

    // --------------------------------------------------------
    // ORTOGONALIZAR
    //
    // Garantiza que los tres ejes formen una cámara válida.
    // --------------------------------------------------------

    derecha =
        normalizarVector(
            productoCruz(
                haciaDondeMiro,
                arriba
            )
        );

    arriba =
        normalizarVector(
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

// ============================================================
// ACTUALIZAR ESTADO
// ============================================================

export function actualizarOrientacion(
    heading,
    beta,
    gamma,
    absoluta = true
) {
    if (
        !Number.isFinite(heading) ||
        !Number.isFinite(beta) ||
        !Number.isFinite(gamma)
    ) {
        return false;
    }

    const orientacion =
        calcularOrientacion(
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

    // --------------------------------------------------------
    // DIRECCIÓN
    // --------------------------------------------------------

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

    // --------------------------------------------------------
    // ALTURA
    // --------------------------------------------------------

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

    estado.direccion =
        azimut;

    estado.altura =
        altura;

    estado.inclinacion =
        beta;

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