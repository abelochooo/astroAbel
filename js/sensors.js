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

let ultimoEventoAbsoluto = 0;

let usandoEventoAbsoluto = false;

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
            /*
             * En iOS el permiso se solicita al pulsar
             * el botón de sensores.
             */

            const permiso =
                await DeviceOrientationEvent
                    .requestPermission();

            return permiso === "granted";
        } catch (error) {
            console.error(error);
            return false;
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

    usandoEventoAbsoluto = false;

    ultimoEventoAbsoluto = 0;

    ultimoEvento = 0;

    /*
     * IMPORTANTE:
     *
     * En iPhone utilizamos principalmente
     * deviceorientation.
     *
     * Safari proporciona webkitCompassHeading
     * ahí, que es mucho más útil para AR que
     * intentar mezclar dos referencias.
     */

    window.addEventListener(
        "deviceorientation",
        manejarOrientacion,
        true
    );

    /*
     * También escuchamos orientationabsolute,
     * pero solamente si realmente aparece.
     *
     * Si aparece de forma válida, dejamos que
     * ese sistema tome prioridad.
     */

    window.addEventListener(
        "deviceorientationabsolute",
        manejarOrientacionAbsoluta,
        true
    );

    const cambiarPantalla = () => {
        if (
            estado.ultimaAlpha !== null &&
            estado.ultimaBeta !== null &&
            estado.ultimaGamma !== null
        ) {
            actualizarOrientacion(
                estado.ultimaAlpha,
                estado.ultimaBeta,
                estado.ultimaGamma,
                estado.orientacion.absoluta
            );

            actualizarInterfaz();

            actualizarPantalla();
        }
    };

    if (
        screen.orientation
    ) {
        screen.orientation.addEventListener(
            "change",
            cambiarPantalla
        );
    } else {
        window.addEventListener(
            "orientationchange",
            cambiarPantalla
        );
    }
}

// ============================================================
// ORIENTACIÓN ABSOLUTA
// ============================================================

function manejarOrientacionAbsoluta(evento) {
    if (
        estado.modo !== "ar"
    ) {
        return;
    }

    if (
        evento.alpha === null ||
        evento.beta === null ||
        evento.gamma === null
    ) {
        return;
    }

    /*
     * Solo aceptamos este sistema si el navegador
     * realmente indica que es absoluto.
     */

    if (
        evento.absolute !== true
    ) {
        return;
    }

    usandoEventoAbsoluto = true;

    ultimoEventoAbsoluto =
        performance.now();

    procesarEvento(
        evento,
        true
    );
}

// ============================================================
// ORIENTACIÓN NORMAL
// ============================================================

function manejarOrientacion(evento) {
    if (
        estado.modo !== "ar"
    ) {
        return;
    }

    /*
     * Si tenemos un flujo absoluto válido,
     * no mezclamos ambos sistemas.
     */

    if (
        usandoEventoAbsoluto &&
        performance.now() -
            ultimoEventoAbsoluto <
            3000
    ) {
        return;
    }

    if (
        evento.alpha === null ||
        evento.beta === null ||
        evento.gamma === null
    ) {
        return;
    }

    /*
     * Si el navegador empieza a proporcionar
     * orientación absoluta, dejamos de usar
     * el flujo normal.
     */

    if (
        evento.absolute === true
    ) {
        usandoEventoAbsoluto = true;

        procesarEvento(
            evento,
            true
        );

        return;
    }

    procesarEvento(
        evento,
        false
    );
}

// ============================================================
// PROCESAR SENSOR
// ============================================================

function procesarEvento(
    evento,
    absoluta
) {
    const ahora =
        performance.now();

    /*
     * Evitar eventos excesivamente rápidos.
     */

    if (
        ahora - ultimoEvento < 8
    ) {
        return;
    }

    ultimoEvento = ahora;

    if (
        evento.alpha === null ||
        evento.beta === null ||
        evento.gamma === null
    ) {
        return;
    }

    let alpha =
        Number(evento.alpha);

    const beta =
        Number(evento.beta);

    const gamma =
        Number(evento.gamma);

    if (
        !Number.isFinite(alpha) ||
        !Number.isFinite(beta) ||
        !Number.isFinite(gamma)
    ) {
        return;
    }

    /*
     * --------------------------------------------------------
     * IPHONE / SAFARI
     * --------------------------------------------------------
     *
     * webkitCompassHeading representa la dirección
     * de la cámara respecto al norte.
     *
     * No la usamos cuando tenemos una orientación
     * absoluta real.
     */

    if (
        !absoluta &&
        typeof evento.webkitCompassHeading ===
            "number" &&
        Number.isFinite(
            evento.webkitCompassHeading
        )
    ) {
        const heading =
            normalizar(
                evento.webkitCompassHeading
            );

        /*
         * La conversión es:
         *
         * heading 0° = Norte
         *
         * DeviceOrientation alpha utiliza
         * la convención inversa para este caso.
         */

        alpha =
            normalizar(
                360 - heading
            );
    }

    if (
        !actualizarOrientacion(
            alpha,
            beta,
            gamma,
            absoluta
        )
    ) {
        return;
    }

    estado.ultimaAlpha = alpha;
    estado.ultimaBeta = beta;
    estado.ultimaGamma = gamma;

    actualizarInterfaz(
        evento,
        absoluta
    );

    actualizarPantalla();
}

// ============================================================
// INTERFAZ
// ============================================================

function actualizarInterfaz(
    evento = null,
    absoluta =
        estado.orientacion.absoluta
) {
    direccionTexto.textContent =
        `${estado.direccion.toFixed(1)}°`;

    alturaTexto.textContent =
        `${estado.altura.toFixed(1)}°`;

    let texto =
        `Dir: ${estado.direccion.toFixed(1)}° ` +
        `Alt: ${estado.altura.toFixed(1)}°`;

    if (evento) {
        texto +=
            ` | α:${Math.round(
                evento.alpha ?? 0
            )}` +

            ` β:${Math.round(
                evento.beta ?? 0
            )}` +

            ` γ:${Math.round(
                evento.gamma ?? 0
            )}` +

            ` | ${
                absoluta
                    ? "ABS"
                    : "IPHONE"
            }`;
    }

    debug.textContent = texto;
}

// ============================================================
// CALIBRAR
// ============================================================

export function calibrarSensores() {
    /*
     * IMPORTANTE:
     *
     * Calibrar NO debe cambiar la referencia
     * astronómica.
     *
     * Simplemente reiniciamos el filtro.
     */

    reiniciarOrientacion();

    if (
        estado.ultimaAlpha !== null &&
        estado.ultimaBeta !== null &&
        estado.ultimaGamma !== null
    ) {
        actualizarOrientacion(
            estado.ultimaAlpha,
            estado.ultimaBeta,
            estado.ultimaGamma,
            estado.orientacion.absoluta
        );
    }

    actualizarInterfaz();

    actualizarPantalla();
}