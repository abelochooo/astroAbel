export const estado = {
    latitud: null,
    longitud: null,

    estrellas: [],
    constelaciones: [],
    planetas: [],

    modo: "ar",

    // --------------------------------------------------
    // ORIENTACIÓN DEL CIELO
    // --------------------------------------------------

    direccion: 0,
    altura: 0,
    inclinacion: 0,

    orientacion: {
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
    },

    // Últimos valores del sensor
    ultimaAlpha: null,
    ultimaBeta: null,
    ultimaGamma: null,

    // Aceleración lineal detectada (traslación física del móvil)
    // Se usa para desconfiar del beta/gamma durante el movimiento.
    aceleracionLineal: 0,

    // Compatibilidad
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