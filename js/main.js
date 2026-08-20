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

import {
    cargarViaLactea
} from "./milkyWay.js";

async function iniciarAplicacion() {
    await cargarViaLactea("./assets/gaia-sky.jpg");

    ajustarCanvas();
    configurarUI();
    iniciarPantalla();
    iniciarCamara();
    actualizarPantalla();
}

iniciarAplicacion();
