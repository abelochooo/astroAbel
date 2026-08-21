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

function mezclarVector(anterior, nuevo, factor) {
    if (anterior === null) {
        return nuevo;
    }

    return normalizarVector({
        x: anterior.x + (nuevo.x - anterior.x) * factor,
        y: anterior.y + (nuevo.y - anterior.y) * factor,
        z: anterior.z + (nuevo.z - anterior.z) * factor
    });
}

// ============================================================
// ESTADO INTERNO DEL FILTRO
// ============================================================

let azimutSuavizado = null;
let alturaSuavizada = null;

/*
 * Estos guardan el "derecha"/"arriba" del frame anterior
 * para poder suavizarlos. Cerca del cenit/nadir el azimut
 * pierde sentido geométricamente (gimbal lock) y cualquier
 * ruido del sensor se amplifica mucho al normalizar un
 * vector casi nulo. Suavizar aquí evita ese temblor/salto.
 */
let derechaSuavizada = null;
let arribaSuavizada = null;

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

    /*
     * Si detectamos que el móvil se está desplazando
     * físicamente (no solo rotando), el acelerómetro
     * puede estar "contaminando" beta/alpha y haciéndonos
     * creer que hemos inclinado el teléfono cuando en
     * realidad solo lo hemos movido en el espacio.
     *
     * En ese caso reducimos mucho el factor de suavizado
     * para no seguir ese ruido; confiamos más en el último
     * valor estable.
     */

    const umbralCongelar = 2.0;   // por encima de esto, ignoramos el frame
    const umbralAmortiguar = 0.6; // por encima de esto, suavizamos muchísimo menos

    /*
     * Movimiento fuerte (traslación clara):
     * no actualizamos nada, nos quedamos con el
     * último valor bueno conocido. Evita que la
     * estrella salte mientras mueves el móvil.
     */
    if (
        estado.aceleracionLineal > umbralCongelar &&
        azimutSuavizado !== null &&
        alturaSuavizada !== null &&
        derechaSuavizada !== null &&
        arribaSuavizada !== null
    ) {
        const orientacionCongelada =
            calcularOrientacion(
                azimutSuavizado,
                alturaSuavizada
            );

        estado.orientacion = {
            haciaDondeMiro:
                orientacionCongelada.haciaDondeMiro,

            derecha:
                derechaSuavizada,

            arriba:
                arribaSuavizada,

            disponible: true,

            absoluta
        };

        estado.inclinacion = gamma;

        return true;
    }

    const enMovimiento =
        estado.aceleracionLineal > umbralAmortiguar;

    const factorAzimut = enMovimiento ? 0.03 : 0.20;
    const factorAltura = enMovimiento ? 0.02 : 0.16;

    azimutSuavizado =
        suavizarAngulo(
            azimutSuavizado,
            heading,
            factorAzimut
        );

    /*
     * La altura se suaviza normalmente.
     */

    if (alturaSuavizada === null) {
        alturaSuavizada = altura;
    } else {
        alturaSuavizada +=
            (altura - alturaSuavizada) *
            factorAltura;
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

    /*
     * Cuanto más cerca del cenit/nadir, más agresivo
     * el suavizado de "derecha"/"arriba" (el giro/roll
     * de la escena). A 90° de distancia del polo (en el
     * horizonte) confiamos al 100% en el valor nuevo; a
     * menos de 15° del polo casi lo congelamos.
     */

    const distanciaAlPolo =
        90 - Math.abs(alturaSuavizada);

    const factorRoll =
        Math.max(
            0.04,
            Math.min(
                1,
                distanciaAlPolo / 15
            )
        );

    derechaSuavizada =
        mezclarVector(
            derechaSuavizada,
            orientacion.derecha,
            factorRoll
        );

    arribaSuavizada =
        mezclarVector(
            arribaSuavizada,
            orientacion.arriba,
            factorRoll
        );

    estado.orientacion = {
        haciaDondeMiro:
            orientacion.haciaDondeMiro,

        derecha:
            derechaSuavizada,

        arriba:
            arribaSuavizada,

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
    derechaSuavizada = null;
    arribaSuavizada = null;

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