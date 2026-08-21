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
    const longitud = Math.hypot(
        v.x,
        v.y,
        v.z
    ) || 1;

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

// ============================================================
// ESTADO INTERNO DEL FILTRO
// ============================================================

let azimutSuavizado = null;
let alturaSuavizada = null;

// ============================================================
// ÁNGULO CIRCULAR
// ============================================================

function suavizarAngulo(
    anterior,
    nuevo,
    factor
) {
    if (anterior === null) {
        return nuevo;
    }

    let diferencia =
        nuevo - anterior;

    while (diferencia > 180) {
        diferencia -= 360;
    }

    while (diferencia < -180) {
        diferencia += 360;
    }

    return (
        anterior +
        diferencia * factor +
        360
    ) % 360;
}

// ============================================================
// ORIENTACIÓN IPHONE
// ============================================================

/*
 * heading:
 *
 * 0   = Norte
 * 90  = Este
 * 180 = Sur
 * 270 = Oeste
 *
 * altura:
 *
 * 0   = horizonte
 * 90  = vertical hacia arriba
 * -90 = vertical hacia abajo
 */

export function calcularOrientacion(
    headingGrados,
    alturaGrados
) {
    const az =
        radianes(headingGrados);

    const alt =
        radianes(alturaGrados);

    /*
     * Sistema utilizado por renderer.js:
     *
     * X = Este
     * Y = Norte
     * Z = Arriba
     */

    const haciaDondeMiro =
        normalizarVector({
            x:
                Math.cos(alt) *
                Math.sin(az),

            y:
                Math.cos(alt) *
                Math.cos(az),

            z:
                Math.sin(alt)
        });

    /*
     * Norte/Sur como referencia horizontal.
     *
     * Construimos "derecha" directamente a partir
     * del vector de visión.
     */

    let derecha =
        productoCruz(
            haciaDondeMiro,
            {
                x: 0,
                y: 0,
                z: 1
            }
        );

    /*
     * Cerca del cenit la cruz puede degenerarse.
     *
     * En ese caso utilizamos Este como referencia.
     */

    if (
        Math.hypot(
            derecha.x,
            derecha.y
        ) < 0.001
    ) {
        derecha =
            productoCruz(
                haciaDondeMiro,
                {
                    x: 1,
                    y: 0,
                    z: 0
                }
            );
    }

    derecha =
        normalizarVector(derecha);

    const arriba =
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
// ACTUALIZAR ORIENTACIÓN
// ============================================================

export function actualizarOrientacion(
    heading,
    altura,
    gamma = 0,
    absoluta = false
) {
    if (
        !Number.isFinite(heading) ||
        !Number.isFinite(altura)
    ) {
        return false;
    }

    /*
     * El rumbo tiene continuidad circular.
     *
     * 359 -> 0
     * no debe provocar un salto de 359 grados.
     */

    azimutSuavizado =
        suavizarAngulo(
            azimutSuavizado,
            heading,
            0.20
        );

    /*
     * La altura se suaviza normalmente.
     */

    if (alturaSuavizada === null) {
        alturaSuavizada = altura;
    } else {
        alturaSuavizada +=
            (altura - alturaSuavizada) *
            0.16;
    }

    /*
     * Limitar pequeñas desviaciones imposibles.
     */

    alturaSuavizada =
        Math.max(
            -90,
            Math.min(
                90,
                alturaSuavizada
            )
        );

    const orientacion =
        calcularOrientacion(
            azimutSuavizado,
            alturaSuavizada
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

    estado.direccion =
        azimutSuavizado;

    estado.altura =
        alturaSuavizada;

    /*
     * Solo informativo.
     */

    estado.inclinacion =
        gamma;

    return true;
}

// ============================================================
// REINICIAR
// ============================================================

export function reiniciarOrientacion() {
    azimutSuavizado = null;
    alturaSuavizada = null;

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