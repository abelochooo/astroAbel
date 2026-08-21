import {
    estado
} from "./state.js";

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
    document.getElementById(
        "direccion"
    );


const alturaTexto =
    document.getElementById(
        "altitud"
    );


const debug =
    document.getElementById(
        "debug"
    );


let ultimoEventoAbsoluto = 0;


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
        typeof DeviceOrientationEvent
            .requestPermission ===
        "function"
    ) {

        /*
         * true pide también permiso para orientación absoluta /
         * magnetómetro cuando el navegador lo soporta.
         */

        const permiso =
            await DeviceOrientationEvent
                .requestPermission(true);

        return permiso === "granted";
    }


    return true;
}


// ============================================================
// ACTIVAR SENSORES
// ============================================================

export function activarSensores() {

    if (
        estado.sensoresEncendidos
    ) {
        return;
    }


    estado.sensoresEncendidos =
        true;


    /*
     * Primero escuchamos orientación absoluta.
     *
     * Chromium puede proporcionar
     * deviceorientationabsolute.
     *
     * Safari normalmente utiliza
     * deviceorientation + webkitCompassHeading.
     */

    window.addEventListener(
        "deviceorientationabsolute",
        manejarOrientacionAbsoluta,
        true
    );


    window.addEventListener(
        "deviceorientation",
        manejarOrientacion,
        true
    );


    if (
        screen.orientation
    ) {

        screen.orientation.addEventListener(
            "change",
            () => {

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
            }
        );

    } else {

        window.addEventListener(
            "orientationchange",
            () => {

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
            }
        );
    }
}


// ============================================================
// ORIENTACIÓN ABSOLUTA
// ============================================================

function manejarOrientacionAbsoluta(
    evento
) {

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

function manejarOrientacion(
    evento
) {

    if (
        estado.modo !== "ar"
    ) {
        return;
    }


    /*
     * Si acabamos de recibir orientación absoluta,
     * ignoramos el evento relativo para no mezclar
     * dos sistemas de referencia diferentes.
     */

    if (
        performance.now() -
        ultimoEventoAbsoluto <
        1000
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


    const tieneBrújula =
    typeof evento.webkitCompassHeading === "number" &&
    Number.isFinite(evento.webkitCompassHeading);

procesarEvento(
    evento,
    Boolean(evento.absolute) || tieneBrújula
);
}


// ============================================================
// PROCESAR SENSOR
// ============================================================

function procesarEvento(
    evento,
    absoluta
) {
    if (
        evento.alpha === null ||
        evento.beta === null ||
        evento.gamma === null
    ) {
        return;
    }

    let heading = null;

const beta =
    Number(evento.beta);

const gamma =
    Number(evento.gamma);

// ========================================================
// RUMBO EN IPHONE
// ========================================================
//
// webkitCompassHeading:
//   0   = Norte
//   90  = Este
//   180 = Sur
//   270 = Oeste
//
// No lo convertimos a alpha.
// Lo pasamos directamente a orientation.js.
// ========================================================

if (
    typeof evento.webkitCompassHeading === "number" &&
    Number.isFinite(evento.webkitCompassHeading)
) {
    heading =
        normalizar(
            evento.webkitCompassHeading
        );
}

// ========================================================
// FALLBACK
// ========================================================
//
// Si el navegador no proporciona brújula,
// utilizamos alpha.
// ========================================================

if (heading === null) {
    if (!Number.isFinite(Number(evento.alpha))) {
        return;
    }

    heading =
        normalizar(
            Number(evento.alpha)
        );
}


    // ========================================================
    // IMPORTANTE
    //
    // Si tenemos orientación absoluta, NO sustituimos alpha
    // por webkitCompassHeading.
    //
    // deviceorientationabsolute ya proporciona una referencia
    // absoluta.
    //
    // webkitCompassHeading solo se utiliza como fallback en
    // dispositivos que no proporcionan orientación absoluta.
    // ========================================================

    if (
        !absoluta &&
        typeof evento.webkitCompassHeading === "number" &&
        Number.isFinite(
            evento.webkitCompassHeading
        )
    ) {
        const heading =
            normalizar(
                evento.webkitCompassHeading
            );

        alpha =
            normalizar(
                360 - heading
            );
    }


    if (
    !actualizarOrientacion(
        heading,
        beta,
        gamma,
        absoluta
    )
) {
    return;
}

estado.ultimaAlpha =
    heading;

    estado.ultimaBeta =
        beta;

    estado.ultimaGamma =
        gamma;


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
    absoluta = estado.orientacion.absoluta
) {

    direccionTexto.textContent =
        `${estado.direccion.toFixed(1)}°`;


    alturaTexto.textContent =
        `${estado.altura.toFixed(1)}°`;


    let texto =
        `Dir: ${estado.direccion.toFixed(1)}° ` +
        `Alt: ${estado.altura.toFixed(1)}°`;


    if (
        evento
    ) {

        texto +=
            ` | α:${Math.round(evento.alpha ?? 0)}` +
            ` β:${Math.round(evento.beta ?? 0)}` +
            ` γ:${Math.round(evento.gamma ?? 0)}` +
            ` | ${absoluta ? "ABS" : "REL"}`;
    }


    debug.textContent =
        texto;
}


// ============================================================
// CALIBRAR
// ============================================================

export function calibrarSensores() {

    /*
     * Ya NO utilizamos beta como horizonte.
     *
     * Eso era uno de los problemas del sistema anterior.
     *
     * Aquí simplemente reiniciamos el filtro de orientación.
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
