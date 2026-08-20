import { estado } from "./state.js";


// ============================================================
// UTILIDADES
// ============================================================

function gradosARadianes(grados) {
    return grados * Math.PI / 180;
}


function normalizarVector(v) {
    const longitud =
        Math.hypot(
            v.x,
            v.y,
            v.z
        );

    if (!longitud) {
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


function productoPunto(a, b) {
    return (
        a.x * b.x +
        a.y * b.y +
        a.z * b.z
    );
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


function sumar(a, b) {
    return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z
    };
}


function multiplicar(v, numero) {
    return {
        x: v.x * numero,
        y: v.y * numero,
        z: v.z * numero
    };
}


function interpolar(a, b, cantidad) {
    return normalizarVector(
        sumar(
            multiplicar(a, 1 - cantidad),
            multiplicar(b, cantidad)
        )
    );
}


// ============================================================
// ROTACIONES DEL SISTEMA DeviceOrientation
//
// La especificación utiliza:
//
// Z -> alpha
// X' -> beta
// Y'' -> gamma
//
// Esto corresponde a:
//
// Rz(alpha) * Rx(beta) * Ry(gamma)
//
// El sistema terrestre que usamos es:
//
// X = Este
// Y = Norte
// Z = Arriba
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
// TRANSFORMAR VECTOR DEL TELÉFONO -> TIERRA
// ============================================================

function transformarVector(
    vector,
    alpha,
    beta,
    gamma
) {

    // Primero gamma alrededor de Y''
    let resultado =
        rotarY(
            vector,
            gamma
        );

    // Después beta alrededor de X'
    resultado =
        rotarX(
            resultado,
            beta
        );

    // Finalmente alpha alrededor de Z
    resultado =
        rotarZ(
            resultado,
            alpha
        );

    return resultado;
}


// ============================================================
// ORIENTACIÓN DE LA PANTALLA
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
// CREAR ORIENTACIÓN DE LA CÁMARA
// ============================================================

export function calcularOrientacion(
    alphaGrados,
    betaGrados,
    gammaGrados
) {

    const alpha =
        gradosARadianes(alphaGrados);

    const beta =
        gradosARadianes(betaGrados);

    const gamma =
        gradosARadianes(gammaGrados);


    /*
     * Sistema físico del dispositivo:
     *
     * X = derecha
     * Y = arriba del teléfono
     * Z = hacia fuera de la pantalla
     *
     * La cámara trasera mira hacia -Z.
     */

    const anguloPantalla =
        gradosARadianes(
            obtenerAnguloPantalla()
        );


    // --------------------------------------------------------
    // DIRECCIÓN HACIA DONDE MIRA LA CÁMARA
    // --------------------------------------------------------

    const vectorCamaraLocal = {
        x: 0,
        y: 0,
        z: -1
    };


    let haciaDondeMiro =
        transformarVector(
            vectorCamaraLocal,
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


    /*
     * DeviceOrientation utiliza la orientación física
     * estándar del teléfono.
     *
     * La pantalla puede estar girada 90/180/270 grados.
     */

    arribaLocal =
        rotarZ(
            arribaLocal,
            -anguloPantalla
        );

    derechaLocal =
        rotarZ(
            derechaLocal,
            -anguloPantalla
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
    // Esto evita que pequeños errores numéricos hagan que
    // derecha/arriba dejen de ser perfectamente perpendiculares.
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
// SUAVIZADO
// ============================================================

let orientacionAnterior = null;


function suavizarOrientacion(
    nuevaOrientacion
) {

    /*
     * Un valor demasiado bajo provoca retraso.
     * Uno demasiado alto deja pasar ruido de la brújula.
     *
     * 0.35 es un punto intermedio.
     */

    const suavizado = 0.35;


    if (!orientacionAnterior) {

        orientacionAnterior = {
            haciaDondeMiro:
                nuevaOrientacion.haciaDondeMiro,

            derecha:
                nuevaOrientacion.derecha,

            arriba:
                nuevaOrientacion.arriba
        };

        return orientacionAnterior;
    }


    const haciaDondeMiro =
        interpolar(
            orientacionAnterior.haciaDondeMiro,
            nuevaOrientacion.haciaDondeMiro,
            suavizado
        );


    let derecha =
        interpolar(
            orientacionAnterior.derecha,
            nuevaOrientacion.derecha,
            suavizado
        );


    let arriba =
        interpolar(
            orientacionAnterior.arriba,
            nuevaOrientacion.arriba,
            suavizado
        );


    // Volvemos a hacer ortogonales los tres vectores.

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


    const orientacion =
        calcularOrientacion(
            alpha,
            beta,
            gamma
        );


    const suavizada =
        suavizarOrientacion(
            orientacion
        );


    estado.orientacion = {
        ...suavizada,

        disponible: true,

        absoluta
    };


    /*
     * También mantenemos direccion/altura porque
     * otras partes de tu aplicación las utilizan.
     */

    const vector =
        suavizada.haciaDondeMiro;


    let azimut =
        Math.atan2(
            vector.x,
            vector.y
        ) *
        180 /
        Math.PI;


    azimut =
        (azimut + 360) % 360;


    const altura =
        Math.asin(
            Math.max(
                -1,
                Math.min(
                    1,
                    vector.z
                )
            )
        ) *
        180 /
        Math.PI;


    estado.direccion =
        azimut;

    estado.altura =
        altura;

    estado.inclinacion =
        beta;


    return true;
}


// ============================================================
// REINICIAR FILTRO
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
