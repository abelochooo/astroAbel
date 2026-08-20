export const estado = {
    latitud: null,
    longitud: null,

    estrellas: [],
    constelaciones: [],
    planetas: [],

    modo: "ar",

    direccion: 0,
    altura: 0,
    inclinacion: 0,

    ultimaBeta: null,
    referenciaBeta: null,

    sensoresEncendidos: false,

    campoVision:
        Number(localStorage.getItem("fovH")) || 66,

    campoVisionVertical: 50,

    moviendo: false,
    inicioX: 0,
    inicioY: 0,
    inicioDireccion: 0,
    inicioAltura: 0,

    objetoBuscado: null,

    intervaloPlanetas: null
};
