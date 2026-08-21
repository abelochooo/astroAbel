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

// ============================================================
// CUATERNIONES
// ============================================================

function cuaternionDesdeEuler(
    alpha,
    beta,
    gamma
) {
    /*
     * Convención de DeviceOrientation:
     *
     * alpha = rotación Z
     * beta  = rotación X
     * gamma = rotación Y
     *
     * Se utiliza la convención YXZ,
     * que es la utilizada habitualmente
     * para DeviceOrientation.
     */

    const a = alpha / 2;
    const b = beta / 2;
    const c = gamma / 2;

    const cA = Math.cos(a);
    const sA = Math.sin(a);

    const cB = Math.cos(b);
    const sB = Math.sin(b);

    const cC = Math.cos(c);
    const sC = Math.sin(c);

    /*
     * Euler YXZ:
     *
     * q = qY * qX * qZ
     */

    let q = {
        x:
            sB * cC * cA -
            cB * sC * sA,

        y:
            cB * sC * cA +
            sB * cC * sA,

        z:
            cB * cC * sA -
            sB * sC * cA,

        w:
            cB * cC * cA +
            sB * sC * sA
    };

    /*
     * Corrección para cámara trasera.
     *
     * Equivale a la transformación utilizada
     * por las implementaciones estándar de
     * DeviceOrientationControls.
     */

    const qC = {
        x: -Math.SQRT1_2,
        y: 0,
        z: 0,
        w: Math.SQRT1_2
    };

    q = multiplicarCuaterniones(q, qC);

    // --------------------------------------------------------
    // ORIENTACIÓN FÍSICA DE LA PANTALLA
    // --------------------------------------------------------

    const anguloPantalla =
        obtenerAnguloPantalla();

    if (anguloPantalla !== 0) {
        const qPantalla =
            cuaternionZ(
                -radianes(anguloPantalla)
            );

        q =
            multiplicarCuaterniones(
                q,
                qPantalla
            );
    }

    return normalizarCuaternion(q);
}

function cuaternionZ(angulo) {
    const mitad = angulo / 2;

    return {
        x: 0,
        y: 0,
        z: Math.sin(mitad),
        w: Math.cos(mitad)
    };
}

function multiplicarCuaterniones(a, b) {
    return {
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
            a.z * b.w,

        w:
            a.w * b.w -
            a.x * b.x -
            a.y * b.y -
            a.z * b.z
    };
}

function normalizarCuaternion(q) {
    const longitud =
        Math.hypot(
            q.x,
            q.y,
            q.z,
            q.w
        ) || 1;

    return {
        x: q.x / longitud,
        y: q.y / longitud,
        z: q.z / longitud,
        w: q.w / longitud
    };
}

function conjugarCuaternion(q) {
    return {
        x: -q.x,
        y: -q.y,
        z: -q.z,
        w: q.w
    };
}

function rotarVectorConCuaternion(v, q) {
    const p = {
        x: v.x,
        y: v.y,
        z: v.z,
        w: 0
    };

    const resultado =
        multiplicarCuaterniones(
            multiplicarCuaterniones(
                q,
                p
            ),
            conjugarCuaternion(q)
        );

    return {
        x: resultado.x,
        y: resultado.y,
        z: resultado.z
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

    if (
        typeof window.orientation === "number"
    ) {
        return window.orientation;
    }

    return 0;
}

// ============================================================
// CALCULAR ORIENTACIÓN
// ============================================================

export function calcularOrientacion(
    alphaGrados,
    betaGrados,
    gammaGrados
) {
    const q =
        cuaternionDesdeEuler(
            radianes(alphaGrados),
            radianes(betaGrados),
            radianes(gammaGrados)
        );

    /*
     * Sistema del renderer:
     *
     * X = Este
     * Y = Norte
     * Z = Arriba
     *
     * Cámara:
     *
     * -Z = delante
     * +Y = arriba
     * +X = derecha
     */

    const delante =
        rotarVectorConCuaternion(
            {
                x: 0,
                y: 0,
                z: -1
            },
            q
        );

    const arriba =
        rotarVectorConCuaternion(
            {
                x: 0,
                y: 1,
                z: 0
            },
            q
        );

    const derecha =
        rotarVectorConCuaternion(
            {
                x: 1,
                y: 0,
                z: 0
            },
            q
        );

    return {
        haciaDondeMiro:
            normalizarVector(delante),

        derecha:
            normalizarVector(derecha),

        arriba:
            normalizarVector(arriba)
    };
}

// ============================================================
// SUAVIZADO
// ============================================================

let orientacionSuavizada = null;

function suavizarVector(
    anterior,
    nuevo,
    factor
) {
    if (!anterior) {
        return {
            ...nuevo
        };
    }

    return normalizarVector({
        x:
            anterior.x +
            (nuevo.x - anterior.x) * factor,

        y:
            anterior.y +
            (nuevo.y - anterior.y) * factor,

        z:
            anterior.z +
            (nuevo.z - anterior.z) * factor
    });
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

    const nueva =
        calcularOrientacion(
            alpha,
            beta,
            gamma
        );

    /*
     * Suavizado moderado.
     *
     * No queremos que el cielo tiemble,
     * pero tampoco introducir demasiado retraso.
     */

    const factor =
        absoluta ? 0.18 : 0.12;

    if (!orientacionSuavizada) {
        orientacionSuavizada = {
            haciaDondeMiro:
                nueva.haciaDondeMiro,

            derecha:
                nueva.derecha,

            arriba:
                nueva.arriba
        };
    } else {
        orientacionSuavizada = {
            haciaDondeMiro:
                suavizarVector(
                    orientacionSuavizada.haciaDondeMiro,
                    nueva.haciaDondeMiro,
                    factor
                ),

            derecha:
                suavizarVector(
                    orientacionSuavizada.derecha,
                    nueva.derecha,
                    factor
                ),

            arriba:
                suavizarVector(
                    orientacionSuavizada.arriba,
                    nueva.arriba,
                    factor
                )
        };
    }

    /*
     * Reconstruimos la base para que los tres
     * vectores permanezcan ortogonales.
     */

    const haciaDondeMiro =
        normalizarVector(
            orientacionSuavizada.haciaDondeMiro
        );

    let derecha =
        normalizarVector(
            productoCruz(
                haciaDondeMiro,
                orientacionSuavizada.arriba
            )
        );

    /*
     * Evitar una base degenerada.
     */

    if (
        Math.hypot(
            derecha.x,
            derecha.y,
            derecha.z
        ) < 0.001
    ) {
        derecha =
            normalizarVector(
                productoCruz(
                    haciaDondeMiro,
                    {
                        x: 0,
                        y: 0,
                        z: 1
                    }
                )
            );
    }

    const arriba =
        normalizarVector(
            productoCruz(
                derecha,
                haciaDondeMiro
            )
        );

    orientacionSuavizada = {
        haciaDondeMiro,
        derecha,
        arriba
    };

    estado.orientacion = {
        haciaDondeMiro,
        derecha,
        arriba,

        disponible: true,
        absoluta
    };

    // --------------------------------------------------------
    // DIRECCIÓN
    // --------------------------------------------------------

    const vector =
        haciaDondeMiro;

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

    estado.direccion = azimut;
    estado.altura = altura;

    /*
     * Beta solamente como información/debug.
     * Ya no se utiliza para posicionar el cielo.
     */

    estado.inclinacion = beta;

    return true;
}

// ============================================================
// REINICIAR
// ============================================================

export function reiniciarOrientacion() {
    orientacionSuavizada = null;

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