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

    const longitud =
        Math.hypot(
            v.x,
            v.y,
            v.z
        );

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
        x:
            a.y * b.z -
            a.z * b.y,

        y:
            a.z * b.x -
            a.x * b.z,

        z:
            a.x * b.y -
            a.y * b.x
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

        y:
            v.y * c -
            v.z * s,

        z:
            v.y * s +
            v.z * c
    };
}


function rotarY(v, angulo) {

    const c = Math.cos(angulo);
    const s = Math.sin(angulo);

    return {
        x:
            v.x * c +
            v.z * s,

        y: v.y,

        z:
            -v.x * s +
            v.z * c
    };
}


function rotarZ(v, angulo) {

    const c = Math.cos(angulo);
    const s = Math.sin(angulo);

    return {
        x:
            v.x * c -
            v.y * s,

        y:
            v.x * s +
            v.y * c,

        z: v.z
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
// DEVICE ORIENTATION
//
// Sistema terrestre:
//
// X = Este
// Y = Norte
// Z = Arriba
//
// Sistema del teléfono:
//
// X = derecha
// Y = arriba
// Z = hacia fuera de la pantalla
//
// La cámara trasera mira hacia -Z.
// ============================================================

function transformarVector(
    vector,
    alpha,
    beta,
    gamma
) {

    // DeviceOrientation:
    //
    // gamma -> Y''
    // beta  -> X'
    // alpha -> Z

    let resultado =
        rotarY(
            vector,
            gamma
        );

    resultado =
        rotarX(
            resultado,
            beta
        );

    resultado =
        rotarZ(
            resultado,
            alpha
        );

    return resultado;
}


// ============================================================
// CALCULAR ORIENTACIÓN 3D
// ============================================================

export function calcularOrientacion(
    alphaGrados,
    betaGrados,
    gammaGrados
) {

    const alpha =
        radianes(alphaGrados);

    const beta =
        radianes(betaGrados);

    const gamma =
        radianes(gammaGrados);


    const orientacionPantalla =
        radianes(
            obtenerAnguloPantalla()
        );


    // --------------------------------------------------------
    // DIRECCIÓN DE LA CÁMARA
    //
    // La cámara trasera mira hacia fuera de la pantalla.
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
    // ARRIBA DE LA PANTALLA
    // --------------------------------------------------------

    let arribaLocal = {
        x: 0,
        y: 1,
        z: 0
    };


    // --------------------------------------------------------
    // DERECHA DE LA PANTALLA
    // --------------------------------------------------------

    let derechaLocal = {
        x: 1,
        y: 0,
        z: 0
    };


    // --------------------------------------------------------
    // CORREGIR ORIENTACIÓN DE PANTALLA
    // --------------------------------------------------------

    arribaLocal =
        rotarZ(
            arribaLocal,
            -orientacionPantalla
        );

    derechaLocal =
        rotarZ(
            derechaLocal,
            -orientacionPantalla
        );


    let derecha =
        transformarVector(
            derechaLocal,
            alpha,
            beta,
            gamma
        );

    let arriba =
        transformarVector(
            arribaLocal,
            alpha,
            beta,
            gamma
        );


    // --------------------------------------------------------
    // NORMALIZAR
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
    // ORTOGONALIZACIÓN
    //
    // Evita errores acumulados de los sensores.
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
// FILTRO
//
// El navegador ya suele entregar una orientación fusionada.
// Un filtro demasiado fuerte provoca que las estrellas
// parezcan moverse detrás del teléfono.
//
// 0.80 = respuesta rápida.
// ============================================================

let orientacionAnterior = null;

const FACTOR_SUAVIZADO = 0.80;


function interpolarVector(
    anterior,
    nuevo,
    factor
) {

    return normalizarVector({

        x:
            anterior.x +
            (
                nuevo.x -
                anterior.x
            ) * factor,

        y:
            anterior.y +
            (
                nuevo.y -
                anterior.y
            ) * factor,

        z:
            anterior.z +
            (
                nuevo.z -
                anterior.z
            ) * factor
    });
}


function suavizarOrientacion(
    nueva
) {

    if (
        !orientacionAnterior
    ) {

        orientacionAnterior = {
            haciaDondeMiro: {
                ...nueva.haciaDondeMiro
            },

            derecha: {
                ...nueva.derecha
            },

            arriba: {
                ...nueva.arriba
            }
        };

        return orientacionAnterior;
    }


    const haciaDondeMiro =
        interpolarVector(
            orientacionAnterior.haciaDondeMiro,
            nueva.haciaDondeMiro,
            FACTOR_SUAVIZADO
        );


    let derecha =
        interpolarVector(
            orientacionAnterior.derecha,
            nueva.derecha,
            FACTOR_SUAVIZADO
        );


    let arriba =
        interpolarVector(
            orientacionAnterior.arriba,
            nueva.arriba,
            FACTOR_SUAVIZADO
        );


    // --------------------------------------------------------
    // Volver a construir una base perfectamente ortogonal.
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


    orientacionAnterior = {
        haciaDondeMiro,
        derecha,
        arriba
    };


    return orientacionAnterior;
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


    const nuevaOrientacion =
        calcularOrientacion(
            alpha,
            beta,
            gamma
        );


    const orientacion =
        suavizarOrientacion(
            nuevaOrientacion
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
    // Mantener estos valores para el resto de la aplicación.
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
        (
            azimut +
            360
        ) % 360;


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

    orientacionAnterior = null;


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