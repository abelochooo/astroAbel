import {
    estado
} from "./state.js";

import {
    normalizar,
    limitar,
    moverSuave
} from "./utils.js";

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


export async function solicitarPermisoSensores() {

    if (
        typeof DeviceOrientationEvent !==
        "undefined" &&

        typeof DeviceOrientationEvent
            .requestPermission ===
            "function"
    ) {

        const permiso =
            await DeviceOrientationEvent
                .requestPermission();

        return permiso === "granted";
    }

    return true;
}


export function activarSensores() {

    if (
        estado.sensoresEncendidos
    ) {
        return;
    }

    estado.sensoresEncendidos =
        true;

    window.addEventListener(
        "deviceorientation",
        manejarOrientacion,
        true
    );
}


function manejarOrientacion(evento) {

    if (
        estado.modo !== "ar" ||
        evento.beta === null ||
        evento.gamma === null
    ) {
        return;
    }

    estado.ultimaBeta =
        evento.beta;

    let nuevaDireccion;

    if (
        typeof evento.webkitCompassHeading ===
        "number"
    ) {

        nuevaDireccion =
            normalizar(
                evento.webkitCompassHeading
            );

    } else if (
        evento.absolute &&
        evento.alpha !== null
    ) {

        nuevaDireccion =
            normalizar(
                360 - evento.alpha
            );

    } else {
        return;
    }

    const referencia =
        estado.referenciaBeta ?? 90;

    const nuevaAltura =
        limitar(
            evento.beta -
            referencia,

            -89,
            89
        );

    const vertical =
        Math.abs(
            nuevaAltura
        );

    let suavizado = 0.15;

    if (vertical > 70) {
        suavizado = 0.02;
    } else if (vertical > 55) {
        suavizado = 0.05;
    } else if (vertical > 40) {
        suavizado = 0.10;
    }

    estado.direccion =
        moverSuave(
            estado.direccion,
            nuevaDireccion,
            suavizado
        );

    estado.altura +=
        (
            nuevaAltura -
            estado.altura
        ) * 0.12;

    estado.inclinacion +=
        (
            limitar(
                evento.gamma,
                -45,
                45
            ) -
            estado.inclinacion
        ) * 0.08;


    direccionTexto.textContent =
        `${estado.direccion.toFixed(1)}°`;

    alturaTexto.textContent =
        `${estado.altura.toFixed(1)}°`;

    debug.textContent =
        `α:${Math.round(
            evento.alpha || 0
        )} ` +

        `β:${Math.round(
            evento.beta
        )} ` +

        `γ:${Math.round(
            evento.gamma
        )}`;

    actualizarPantalla();
}


export function calibrarSensores() {

    if (
        estado.ultimaBeta === null
    ) {
        alert(
            "Activa los sensores primero."
        );

        return;
    }

    estado.referenciaBeta =
        estado.ultimaBeta;

    estado.altura = 0;

    alturaTexto.textContent =
        "0°";

    actualizarPantalla();
}
