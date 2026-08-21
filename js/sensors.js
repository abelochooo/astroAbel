import { estado } from "./state.js";

import {
    normalizar
} from "./utils.js";

import {
    actualizarOrientacion,
    reiniciarOrientacion
} from "./orientation.js";

import {
    actualizarPantalla
} from "./renderer.js";

const direccionTexto =
    document.getElementById("direccion");

const alturaTexto =
    document.getElementById("altitud");

const debug =
    document.getElementById("debug");

let ultimoEvento = 0;

// ============================================================
// PERMISOS
// ============================================================

export async function solicitarPermisoSensores() {
    if (
        typeof DeviceOrientationEvent ===
        "undefined"
    ) {
        return false;
    }

    if (
        typeof DeviceOrientationEvent.requestPermission ===
        "function"
    ) {
        try {
            const permiso =
                await DeviceOrientationEvent
                    .requestPermission();

            if (permiso !== "granted") {
                return false;
            }
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    /*
     * iOS pide un permiso APARTE para DeviceMotionEvent
     * (aceleración). Lo necesitamos para detectar
     * traslación física del móvil y así no confundirla
     * con una inclinación real. Si el usuario lo deniega,
     * seguimos funcionando, simplemente sin ese filtro.
     */

    if (
        typeof DeviceMotionEvent !== "undefined" &&
        typeof DeviceMotionEvent.requestPermission ===
            "function"
    ) {
        try {
            await DeviceMotionEvent.requestPermission();
        } catch (error) {
            console.error(error);
        }
    }

    return true;
}

// ============================================================
// ACTIVAR SENSORES
// ============================================================

export function activarSensores() {
    if (estado.sensoresEncendidos) {
        return;
    }

    estado.sensoresEncendidos = true;

    ultimoEvento = 0;

    window.addEventListener(
        "deviceorientation",
        manejarOrientacion,
        true
    );

    /*
     * Detectar traslación física del móvil.
     *
     * "acceleration" (sin gravedad) solo es distinto de ~0
     * cuando el móvil se desplaza en el espacio, no cuando
     * solo rota. Lo usamos para desconfiar de beta/gamma
     * mientras dura ese movimiento, evitando que las
     * estrellas "viajen" contigo.
     */

    window.addEventListener(
        "devicemotion",
        manejarMovimiento,
        true
    );

    /*
     * NO utilizamos deviceorientationabsolute.
     *
     * En iPhone/Safari queremos un único flujo:
     *
     * deviceorientation
     *       +
     * webkitCompassHeading
     */

    const actualizarTrasRotacionPantalla = () => {
        if (
            estado.ultimaAlpha !== null &&
            estado.ultimaBeta !== null &&
            estado.ultimaGamma !== null
        ) {
            manejarValores(
                estado.ultimaAlpha,
                estado.ultimaBeta,
                estado.ultimaGamma,
                estado.ultimaHeading
            );
        }
    };

    if (screen.orientation) {
        screen.orientation.addEventListener(
            "change",
            actualizarTrasRotacionPantalla
        );
    } else {
        window.addEventListener(
            "orientationchange",
            actualizarTrasRotacionPantalla
        );
    }
}

// ============================================================
// EVENTO DEVICEORIENTATION
// ============================================================

function manejarOrientacion(evento) {
    if (
        estado.modo !== "ar"
    ) {
        return;
    }

    if (
        evento.beta === null ||
        evento.gamma === null
    ) {
        return;
    }

    const heading =
        obtenerHeading(evento);

    if (
        heading === null
    ) {
        return;
    }

    manejarValores(
        evento.alpha,
        evento.beta,
        evento.gamma,
        heading
    );
}

// ============================================================
// DETECTAR TRASLACIÓN FÍSICA (devicemotion)
// ============================================================

function manejarMovimiento(evento) {
    const acc = evento.acceleration;

    if (
        !acc ||
        !Number.isFinite(acc.x) ||
        !Number.isFinite(acc.y) ||
        !Number.isFinite(acc.z)
    ) {
        /*
         * Algunos navegadores/dispositivos no dan
         * "acceleration" sin gravedad de forma fiable.
         * En ese caso no penalizamos nada.
         */
        estado.aceleracionLineal = 0;
        return;
    }

    const magnitud = Math.hypot(
        acc.x,
        acc.y,
        acc.z
    );

    /*
     * Suavizamos también esta señal para no reaccionar
     * a ruido de un solo frame.
     */
    estado.aceleracionLineal +=
        (magnitud - estado.aceleracionLineal) * 0.3;
}

// ============================================================
// OBTENER RUMBO
// ============================================================

function obtenerHeading(evento) {
    /*
     * Safari / iPhone
     *
     * Esta es la referencia magnética/geográfica
     * que queremos utilizar para el azimut.
     */

    if (
        typeof evento.webkitCompassHeading ===
            "number" &&
        Number.isFinite(
            evento.webkitCompassHeading
        )
    ) {
        return normalizar(
            evento.webkitCompassHeading
        );
    }

    /*
     * Fallback para navegadores que no tienen
     * webkitCompassHeading.
     *
     * En ese caso alpha es nuestra mejor
     * aproximación.
     */

    if (
        typeof evento.alpha === "number" &&
        Number.isFinite(evento.alpha)
    ) {
        return normalizar(
            360 - evento.alpha
        );
    }

    return null;
}

// ============================================================
// PROCESAR VALORES
// ============================================================

function manejarValores(
    alpha,
    beta,
    gamma,
    heading
) {
    const ahora =
        performance.now();

    /*
     * Evitar una frecuencia exagerada.
     */

    if (
        ahora - ultimoEvento < 12
    ) {
        return;
    }

    ultimoEvento = ahora;

    /*
     * --------------------------------------------------------
     * ALTURA DE LA CÁMARA
     * --------------------------------------------------------
     *
     * beta:
     *
     * 0°  = teléfono aproximadamente horizontal
     * 90° = teléfono vertical
     *
     * Para la cámara trasera:
     *
     * beta - 90
     *
     * da una aproximación directa de cuánto
     * estamos apuntando hacia arriba.
     *
     * --------------------------------------------------------
     */

    let altura =
        Number(beta) - 90;

    /*
     * gamma aparece principalmente al girar
     * el teléfono lateralmente.
     *
     * No lo utilizamos para cambiar el azimut.
     *
     * Eso evita el salto Este/Oeste que tenías.
     */

    if (
        !Number.isFinite(altura)
    ) {
        return;
    }

    altura =
        Math.max(
            -90,
            Math.min(
                90,
                altura
            )
        );

    if (
        !actualizarOrientacion(
            heading,
            altura,
            Number(gamma) || 0,
            false
        )
    ) {
        return;
    }

    estado.ultimaAlpha =
        Number.isFinite(alpha)
            ? Number(alpha)
            : null;

    estado.ultimaBeta =
        Number(beta);

    estado.ultimaGamma =
        Number(gamma);

    /*
     * Guardamos el heading real para que
     * orientationchange pueda recalcular.
     */

    estado.ultimaHeading =
        heading;

    actualizarInterfaz(
        heading,
        altura,
        alpha,
        beta,
        gamma
    );

    actualizarPantalla();
}

// ============================================================
// INTERFAZ
// ============================================================

function actualizarInterfaz(
    heading,
    altura,
    alpha,
    beta,
    gamma
) {
    direccionTexto.textContent =
        `${estado.direccion.toFixed(1)}°`;

    alturaTexto.textContent =
        `${estado.altura.toFixed(1)}°`;

    debug.textContent =
        `Dir: ${estado.direccion.toFixed(1)}° ` +
        `Alt: ${estado.altura.toFixed(1)}° ` +
        `| H:${Math.round(heading)} ` +
        `β:${Math.round(beta ?? 0)} ` +
        `γ:${Math.round(gamma ?? 0)}`;
}

// ============================================================
// CALIBRAR
// ============================================================

export function calibrarSensores() {
    reiniciarOrientacion();

    /*
     * No alteramos el norte.
     *
     * Al siguiente evento del sensor se reconstruye
     * la orientación desde el heading real del iPhone.
     */

    actualizarPantalla();
}