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
// ROTACIONES
// ============================================================

function rotarX(v, angulo) {
    const c = Math.cos(angulo);
    const s = Math.sin(angulo);

    return {
        x: v.x,
        y: v.y * c - v.z * s,
        z: v.y * s + v.z * c
    };
}

function rotarY(v, angulo) {
    const c = Math.cos(angulo);
    const s = Math.sin(angulo);

    return {
        x: v.x * c + v.z * s,
        y: v.y,
        z: -v.x * s + v.z * c
    };
}

function rotarZ(v, angulo) {
    const c = Math.cos(angulo);
    const s = Math.sin(angulo);

    return {
        x: v.x * c - v.y * s,
        y: v.x * s + v.y * c,
        z: v.z
    };
}

// ============================================================
// ORIENTACIÓN DE PANTALLA
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
// ORIENTACIÓN
//
// Sistema del cielo:
//
// X = Este
// Y = Norte
// Z = Arriba
//
// Sistema local:
//
// X = derecha
// Y = arriba
// Z = hacia fuera de la pantalla
// ============================================================

export function calcularOrientacion(
    alphaGrados,
    betaGrados,
    gammaGrados
) {
    const alpha = radianes(alphaGrados);
    const beta = radianes(betaGrados);
    const gamma = radianes(gammaGrados);

    const anguloPantalla =
        radianes(obtenerAnguloPantalla());

    // Cámara trasera:
    // mira hacia fuera de la pantalla.
    let haciaDondeMiro = transformarVector(
        {
            x: 0,
            y: 0,
            z: -1
        },
        alpha,
        beta,
        gamma
    );

    // Arriba de pantalla.
    let arribaLocal = {
        x: 0,
        y: 1,
        z: 0
    };

    // Derecha de pantalla.
    let derechaLocal = {
        x: 1,
        y: 0,
        z: 0
    };

    // Corregir rotación física de pantalla.
    arribaLocal = rotarZ(
        arribaLocal,
        -anguloPantalla
    );

    derechaLocal = rotarZ(
        derechaLocal,
        -anguloPantalla
    );

    let arriba = transformarVector(
        arribaLocal,
        alpha,
        beta,
        gamma
    );

    let derecha = transformarVector(
        derechaLocal,
        alpha,
        beta,
        gamma
    );

    haciaDondeMiro =
        normalizarVector(haciaDondeMiro);

    /*
     * Construimos una base ortogonal usando
     * la dirección de visión y el vector arriba.
     *
     * Esto evita pequeñas deformaciones producidas
     * por ruido del sensor.
     */

    derecha = normalizarVector(
        productoCruz(
            haciaDondeMiro,
            arriba
        )
    );

    arriba = normalizarVector(
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
// TRANSFORMACIÓN
// ============================================================

function transformarVector(
    vector,
    alpha,
    beta,
    gamma
) {
    /*
     * Esta secuencia corresponde al sistema de
     * DeviceOrientation y se mantiene única para
     * todos los sensores.
     */

    let resultado = rotarY(
        vector,
        gamma
    );

    resultado = rotarX(
        resultado,
        beta
    );

    resultado = rotarZ(
        resultado,
        alpha
    );

    return resultado;
}

// ============================================================
// ACTUALIZAR ESTADO
// ============================================================

export function actualizarOrientacion(
    alpha,
    beta,
    gamma,
    absoluta = false
) {
    if (
        !Number.isFinite(alpha) ||
        !Number.isFinite(beta) ||
        !Number.isFinite(gamma)
    ) {
        return false;
    }

    const orientacion =
        calcularOrientacion(
            alpha,
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

    // ========================================================
    // DIRECCIÓN
    // ========================================================

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

    // ========================================================
    // ALTURA
    // ========================================================

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