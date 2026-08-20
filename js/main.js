import {
    ajustarCanvas,
    actualizarPantalla
} from "./renderer.js";

import {
    configurarUI,
    iniciarPantalla
} from "./ui.js";

import {
    iniciarCamara
} from "./camera.js";


async function iniciarAplicacion() {

    ajustarCanvas();

    configurarUI();

    iniciarPantalla();

    iniciarCamara();

    actualizarPantalla();
}


iniciarAplicacion();
