import {
    estado
} from "./state.js";

import {
    aRadianes,
    aGrados,
    normalizar,
    limitar,
    diferenciaAngulo
} from "./utils.js";

import {
    convertirRA,
    convertirDec,
    calcularAltura,
    tiempoSideral
} from "./astronomy.js";

import {
    dibujarViaLactea
} from "./milkyWay.js";


export const canvas =
    document.getElementById(
        "cieloCamara"
    );

export const ctx =
    canvas.getContext("2d");


export function actualizarFOV() {

    if (!innerWidth) {
        return;
    }

    estado.campoVisionVertical =
        2 *
        aGrados(
            Math.atan(
                Math.tan(
                    aRadianes(
                        estado.campoVision
                    ) / 2
                ) *
                innerHeight /
                innerWidth
            )
        );
}


export function crearVector(
    azimut,
    altura
) {

    const az =
        aRadianes(azimut);

    const alt =
        aRadianes(altura);

    return {

        x:
            Math.cos(alt) *
            Math.sin(az),

        y:
            Math.cos(alt) *
            Math.cos(az),

        z:
            Math.sin(alt)
    };
}


export function productoPunto(a, b) {

    return (
        a.x * b.x +
        a.y * b.y +
        a.z * b.z
    );
}


export function productoCruz(a, b) {

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


export function normalizarVector(vector) {

    const tamaño =
        Math.hypot(
            vector.x,
            vector.y,
            vector.z
        ) || 1;

    return {

        x: vector.x / tamaño,
        y: vector.y / tamaño,
        z: vector.z / tamaño
    };
}


export function crearCamara() {

    // ========================================================
    // MODO AR
    // ========================================================

    if (
        estado.modo === "ar" &&
        estado.orientacion &&
        estado.orientacion.disponible
    ) {

        return {

            haciaDondeMiro: {
                x:
                    estado.orientacion
                        .haciaDondeMiro.x,

                y:
                    estado.orientacion
                        .haciaDondeMiro.y,

                z:
                    estado.orientacion
                        .haciaDondeMiro.z
            },

            derecha: {
                x:
                    estado.orientacion
                        .derecha.x,

                y:
                    estado.orientacion
                        .derecha.y,

                z:
                    estado.orientacion
                        .derecha.z
            },

            arriba: {
                x:
                    estado.orientacion
                        .arriba.x,

                y:
                    estado.orientacion
                        .arriba.y,

                z:
                    estado.orientacion
                        .arriba.z
            }
        };
    }


    // ========================================================
    // MODO MAPA LIBRE
    // ========================================================

    const haciaDondeMiro =
        crearVector(
            estado.direccion,
            estado.altura
        );


    let derecha =
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


    if (
        Math.hypot(
            derecha.x,
            derecha.y
        ) < 0.001
    ) {

        derecha =
            normalizarVector(
                productoCruz(
                    haciaDondeMiro,
                    {
                        x: 1,
                        y: 0,
                        z: 0
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


    return {
        haciaDondeMiro,
        derecha,
        arriba
    };
}



export function ponerEnPantalla(
    azimut,
    alturaObjeto,
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {

    const objeto =
        crearVector(
            azimut,
            alturaObjeto
        );

    const delante =
        productoPunto(
            objeto,
            camaraActual.haciaDondeMiro
        );

    if (delante <= 0.001) {
        return null;
    }

    const x =
        centroX +
        fx *
        productoPunto(
            objeto,
            camaraActual.derecha
        ) /
        delante;

    const y =
        centroY -
        fy *
        productoPunto(
            objeto,
            camaraActual.arriba
        ) /
        delante;

    const margen = 150;

    if (
        x < -margen ||
        x > innerWidth + margen ||
        y < -margen ||
        y > innerHeight + margen
    ) {
        return null;
    }

    return {
        x,
        y
    };
}


function dibujarEstrellas(
    horaSideral,
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {

    for (
        const estrella of estado.estrellas
    ) {

        const ra =
            convertirRA(
                estrella.RA
            );

        const dec =
            convertirDec(
                estrella.Dec
            );

        if (
            ra === null ||
            dec === null
        ) {
            continue;
        }

        const posicion =
            calcularAltura(
                ra,
                dec,
                horaSideral
            );

        const punto =
            ponerEnPantalla(
                posicion.azimut,
                posicion.altura,
                camaraActual,
                fx,
                fy,
                centroX,
                centroY
            );

        if (!punto) {
            continue;
        }

        const magnitud =
            Number(estrella.V);

        if (!Number.isFinite(magnitud)) {
            continue;
        }

        const tamaño =
            limitar(
                3.8 -
                magnitud *
                0.45,
                0.5,
                5
            );

        const brillo =
            limitar(
                1.2 -
                magnitud / 8,
                0.15,
                1
            );

        ctx.beginPath();

        ctx.arc(
            punto.x,
            punto.y,
            tamaño,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            `rgba(255,255,255,${brillo})`;

        ctx.fill();
    }
}


function dibujarConstelaciones(
    horaSideral,
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {

    ctx.strokeStyle =
        "rgba(120,170,255,.55)";

    ctx.lineWidth = 1;

    ctx.font =
        "13px Arial";

    ctx.fillStyle =
        "rgba(180,210,255,.75)";

    for (
        const constelacion
        of estado.constelaciones
    ) {

        let nombrePunto = null;

        for (
            const linea
            of constelacion.lineas || []
        ) {

            ctx.beginPath();

            let dibujado = false;

            for (
                let i = 0;
                i < linea.length - 1;
                i++
            ) {

                const punto1 =
                    linea[i];

                const punto2 =
                    linea[i + 1];

                const cielo1 =
                    calcularAltura(
                        punto1[0],
                        punto1[1],
                        horaSideral
                    );

                const cielo2 =
                    calcularAltura(
                        punto2[0],
                        punto2[1],
                        horaSideral
                    );

                const pantalla1 =
                    ponerEnPantalla(
                        cielo1.azimut,
                        cielo1.altura,
                        camaraActual,
                        fx,
                        fy,
                        centroX,
                        centroY
                    );

                const pantalla2 =
                    ponerEnPantalla(
                        cielo2.azimut,
                        cielo2.altura,
                        camaraActual,
                        fx,
                        fy,
                        centroX,
                        centroY
                    );

                if (
                    !pantalla1 ||
                    !pantalla2
                ) {
                    continue;
                }

                ctx.moveTo(
                    pantalla1.x,
                    pantalla1.y
                );

                ctx.lineTo(
                    pantalla2.x,
                    pantalla2.y
                );

                if (!nombrePunto) {
                    nombrePunto =
                        pantalla1;
                }

                dibujado = true;
            }

            if (dibujado) {
                ctx.stroke();
            }
        }

        if (nombrePunto) {

            ctx.fillText(
                constelacion.nombre || "",
                nombrePunto.x + 6,
                nombrePunto.y - 6
            );
        }
    }
}


function dibujarPlanetas(
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {

    const tamaños = {

        Sol: 16,
        Luna: 13,
        Júpiter: 8,
        Saturno: 7,
        Venus: 6,
        Marte: 5,
        Mercurio: 4
    };

    const colores = {

        Sol: "#fff0a0",
        Luna: "#e8e8e0",
        Júpiter: "#e8c28c",
        Saturno: "#ead6a0",
        Venus: "#fff0b0",
        Marte: "#e77d52",
        Mercurio: "#bdb7a8"
    };

    ctx.textAlign =
        "center";

    ctx.font =
        "13px Arial";

    for (
        const planeta of estado.planetas
    ) {

        const punto =
            ponerEnPantalla(
                planeta.azimut,
                planeta.altura,
                camaraActual,
                fx,
                fy,
                centroX,
                centroY
            );

        if (!punto) {
            continue;
        }

        const tamaño =
            tamaños[
                planeta.nombre
            ] || 5;

        ctx.beginPath();

        ctx.arc(
            punto.x,
            punto.y,
            tamaño,
            0,
            Math.PI * 2
        );

        ctx.fillStyle =
            colores[
                planeta.nombre
            ] || "#ffd27f";

        ctx.fill();

        ctx.fillStyle =
            "rgba(255,255,255,.9)";

        ctx.fillText(
            planeta.nombre,
            punto.x,
            punto.y -
            tamaño -
            6
        );
    }

    ctx.textAlign =
        "left";
}


function dibujarObjetivo(
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {

    if (!estado.objetoBuscado) {
        return;
    }

    const punto =
        ponerEnPantalla(
            estado.objetoBuscado.azimut,
            estado.objetoBuscado.altura,
            camaraActual,
            fx,
            fy,
            centroX,
            centroY
        );

    ctx.textAlign =
        "center";

    if (punto) {

        ctx.beginPath();

        ctx.arc(
            punto.x,
            punto.y,
            25,
            0,
            Math.PI * 2
        );

        ctx.strokeStyle =
            "#00ff88";

        ctx.lineWidth = 3;

        ctx.stroke();

        ctx.fillStyle =
            "#00ff88";

        ctx.font =
            "bold 15px Arial";

        ctx.fillText(
            `🎯 ${estado.objetoBuscado.nombre}`,
            punto.x,
            punto.y - 34
        );

    } else {

        const diferenciaHorizontal =
            diferenciaAngulo(
                estado.objetoBuscado.azimut,
                estado.direccion
            );

        const diferenciaVertical =
            estado.objetoBuscado.altura -
            estado.altura;

        ctx.fillStyle =
            "#00ff88";

        ctx.font =
            "bold 18px Arial";

        ctx.fillText(

            `${Math.abs(Math.round(
                diferenciaHorizontal
            ))}° ` +

            `${diferenciaHorizontal > 0
                ? "→"
                : "←"}   ` +

            `${Math.abs(Math.round(
                diferenciaVertical
            ))}° ` +

            `${diferenciaVertical > 0
                ? "↑"
                : "↓"}`,

            innerWidth / 2,
            innerHeight - 80
        );
    }

    ctx.textAlign =
        "left";
}


export function dibujarCielo() {

    if (
        estado.latitud === null ||
        estado.longitud === null
    ) {
        return;
    }

    const ancho =
        innerWidth;

    const alto =
        innerHeight;

    const centroX =
        ancho / 2;

    const centroY =
        alto / 2;

    ctx.clearRect(
        0,
        0,
        ancho,
        alto
    );


    const camaraActual =
        crearCamara();

    const horaSideral =
        tiempoSideral();

    const fx =
        centroX /
        Math.tan(
            aRadianes(
                estado.campoVision
            ) / 2
        );

    const fy =
        centroY /
        Math.tan(
            aRadianes(
                estado.campoVisionVertical
            ) / 2
        );


    // ==========================================
    // VÍA LÁCTEA
    // ==========================================

    dibujarViaLactea(
        ctx,
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );


    // ==========================================
    // CONSTELACIONES
    // ==========================================

    dibujarConstelaciones(
        horaSideral,
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );


    // ==========================================
    // ESTRELLAS
    // ==========================================

    dibujarEstrellas(
        horaSideral,
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );


    // ==========================================
    // PLANETAS
    // ==========================================

    dibujarPlanetas(
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );


    // ==========================================
    // OBJETIVO
    // ==========================================

    dibujarObjetivo(
        camaraActual,
        fx,
        fy,
        centroX,
        centroY
    );
}


let renderPendiente = false;


export function actualizarPantalla() {

    if (renderPendiente) {
        return;
    }

    renderPendiente = true;

    requestAnimationFrame(() => {

        renderPendiente = false;

        dibujarCielo();

    });
}


export function ajustarCanvas() {

    const pixelRatio =
        Math.min(
            window.devicePixelRatio || 1,
            2
        );

    canvas.width =
        innerWidth *
        pixelRatio;

    canvas.height =
        innerHeight *
        pixelRatio;

    canvas.style.width =
        `${innerWidth}px`;

    canvas.style.height =
        `${innerHeight}px`;

    ctx.setTransform(
        pixelRatio,
        0,
        0,
        pixelRatio,
        0,
        0
    );

    actualizarFOV();

    actualizarPantalla();
}
