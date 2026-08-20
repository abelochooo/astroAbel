import {
    estado
} from "./state.js";

import {
    aRadianes,
    aGrados,
    normalizar
} from "./utils.js";

import {
    tiempoSideral
} from "./astronomy.js";


let mapaViaLactea = null;

let imagenPixeles = null;

let anchoImagen = 0;
let altoImagen = 0;

let canvasMapa = null;
let ctxMapa = null;


/*
==================================================
CARGAR MAPA GAIA
==================================================
*/

export async function cargarViaLactea(ruta) {

    return new Promise((resolve, reject) => {

        const imagen =
            new Image();

        imagen.onload = () => {

            mapaViaLactea =
                imagen;

            anchoImagen =
                imagen.naturalWidth;

            altoImagen =
                imagen.naturalHeight;

            /*
            Creamos un canvas interno.

            Lo utilizamos para leer los píxeles
            de la imagen Gaia.
            */

            canvasMapa =
                document.createElement(
                    "canvas"
                );

            canvasMapa.width =
                anchoImagen;

            canvasMapa.height =
                altoImagen;

            ctxMapa =
                canvasMapa.getContext(
                    "2d",
                    {
                        willReadFrequently: true
                    }
                );

            ctxMapa.drawImage(
                imagen,
                0,
                0
            );

            imagenPixeles =
                ctxMapa.getImageData(
                    0,
                    0,
                    anchoImagen,
                    altoImagen
                ).data;

            console.log(
                "Mapa Gaia cargado:",
                anchoImagen,
                "x",
                altoImagen
            );

            resolve(imagen);
        };


        imagen.onerror = () => {

            reject(
                new Error(
                    "No se pudo cargar la Vía Láctea: " +
                    ruta
                )
            );

        };


        imagen.src =
            ruta;
    });
}


/*
==================================================
MATRIZ ECUATORIAL → GALÁCTICA
==================================================

Transformación ICRS/J2000 → galácticas.

La usamos para encontrar dónde está cada
punto del cielo dentro del mapa Gaia.
==================================================
*/

function ecuatorialAGalactico(
    x,
    y,
    z
) {

    return {

        x:
            -0.0548755604162154 * x +
            -0.8734370902348850 * y +
            -0.4838350155487132 * z,

        y:
            0.4941094278755837 * x +
            -0.4448296299600112 * y +
            0.7469822444972189 * z,

        z:
            -0.8676661490190047 * x +
            -0.1980763734312015 * y +
            0.4559837761750669 * z
    };
}


/*
==================================================
HORIZONTAL → ECUATORIAL
==================================================
*/

function horizontalAEcuatorial(
    azimut,
    altura,
    horaSideral
) {

    const az =
        aRadianes(
            azimut
        );

    const alt =
        aRadianes(
            altura
        );

    const lat =
        aRadianes(
            estado.latitud
        );


    const sinAlt =
        Math.sin(alt);

    const cosAlt =
        Math.cos(alt);

    const sinLat =
        Math.sin(lat);

    const cosLat =
        Math.cos(lat);


    /*
    De horizontal a declinación.
    */

    const sinDec =
        sinAlt * sinLat +
        cosAlt *
        cosLat *
        Math.cos(az);


    const dec =
        Math.asin(
            Math.max(
                -1,
                Math.min(
                    1,
                    sinDec
                )
            )
        );


    /*
    Ángulo horario.
    */

    const y =
        -Math.sin(az) *
        cosAlt;

    const x =
        cosLat * sinAlt -
        sinLat *
        cosAlt *
        Math.cos(az);


    const hora =
        aGrados(
            Math.atan2(
                y,
                x
            )
        );


    /*
    RA = tiempo sideral - ángulo horario.
    */

    const ra =
        normalizar(
            horaSideral -
            hora
        );


    return {

        ra,

        dec:
            aGrados(
                dec
            )
    };
}


/*
==================================================
ECUATORIAL → VECTOR
==================================================
*/

function ecuatorialAVector(
    ra,
    dec
) {

    const raRad =
        aRadianes(
            ra
        );

    const decRad =
        aRadianes(
            dec
        );


    return {

        x:
            Math.cos(decRad) *
            Math.cos(raRad),

        y:
            Math.cos(decRad) *
            Math.sin(raRad),

        z:
            Math.sin(decRad)
    };
}


/*
==================================================
GALÁCTICO → UV DE LA IMAGEN
==================================================

La imagen de Gaia es equirectangular.

X = longitud galáctica
Y = latitud galáctica
==================================================
*/

function galacticoAImagen(
    vector
) {

    const longitud =
        normalizar(
            aGrados(
                Math.atan2(
                    vector.y,
                    vector.x
                )
            )
        );

    const latitud =
        aGrados(
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


    const u =
        longitud / 360;

    const v =
        (90 - latitud) / 180;


    return {
        u,
        v
    };
}


/*
==================================================
 OBTENER PÍXEL DEL MAPA
==================================================
*/

function obtenerPixel(
    u,
    v
) {

    if (!imagenPixeles) {
        return null;
    }


    let x =
        Math.floor(
            u *
            anchoImagen
        );

    let y =
        Math.floor(
            v *
            altoImagen
        );


    /*
    Wrap horizontal.
    */

    x =
        (
            x %
            anchoImagen +
            anchoImagen
        ) %
        anchoImagen;


    y =
        Math.max(
            0,
            Math.min(
                altoImagen - 1,
                y
            )
        );


    const indice =
        (
            y *
            anchoImagen +
            x
        ) * 4;


    return {

        r:
            imagenPixeles[
                indice
            ],

        g:
            imagenPixeles[
                indice + 1
            ],

        b:
            imagenPixeles[
                indice + 2
            ],

        a:
            imagenPixeles[
                indice + 3
            ]
    };
}


/*
==================================================
DIBUJAR VÍA LÁCTEA
==================================================
*/

export function dibujarViaLactea(
    ctx,
    camaraActual,
    fx,
    fy,
    centroX,
    centroY
) {

    if (
        !mapaViaLactea ||
        !imagenPixeles
    ) {
        return;
    }


    if (
        estado.latitud === null ||
        estado.longitud === null
    ) {
        return;
    }


    /*
    ------------------------------------------------
    RESOLUCIÓN DEL MAPA

    No calculamos cada píxel del móvil.

    Eso sería demasiado pesado.

    Calculamos una textura reducida y la
    ampliamos sobre el canvas.
    ------------------------------------------------
    */

    const escala =
        Math.min(
            0.30,
            420 / innerWidth
        );


    const ancho =
        Math.max(
            160,
            Math.floor(
                innerWidth *
                escala
            )
        );


    const alto =
        Math.max(
            120,
            Math.floor(
                innerHeight *
                escala
            )
        );


    /*
    Canvas temporal.
    */

    const canvas =
        document.createElement(
            "canvas"
        );

    canvas.width =
        ancho;

    canvas.height =
        alto;


    const contexto =
        canvas.getContext(
            "2d"
        );


    const imagen =
        contexto.createImageData(
            ancho,
            alto
        );


    const datos =
        imagen.data;


    const sideral =
        tiempoSideral();


    let indice =
        0;


    /*
    ------------------------------------------------
    RECORRER PANTALLA
    ------------------------------------------------
    */

    for (
        let y = 0;
        y < alto;
        y++
    ) {

        for (
            let x = 0;
            x < ancho;
            x++
        ) {


            /*
            Coordenada real de pantalla.
            */

            const pantallaX =
                x /
                escala;

            const pantallaY =
                y /
                escala;


            /*
            Coordenadas de cámara.

            0,0 = centro de pantalla.
            */

            const cameraX =
                (
                    pantallaX -
                    centroX
                ) / fx;


            const cameraY =
                (
                    centroY -
                    pantallaY
                ) / fy;


            /*
            Ray que sale de la cámara.
            */

            let vx =
                camaraActual
                    .haciaDondeMiro.x +

                cameraX *
                camaraActual
                    .derecha.x +

                cameraY *
                camaraActual
                    .arriba.x;


            let vy =
                camaraActual
                    .haciaDondeMiro.y +

                cameraX *
                camaraActual
                    .derecha.y +

                cameraY *
                camaraActual
                    .arriba.y;


            let vz =
                camaraActual
                    .haciaDondeMiro.z +

                cameraX *
                camaraActual
                    .derecha.z +

                cameraY *
                camaraActual
                    .arriba.z;


            /*
            Normalizamos.
            */

            const longitud =
                Math.hypot(
                    vx,
                    vy,
                    vz
                );


            vx /=
                longitud;

            vy /=
                longitud;

            vz /=
                longitud;


            /*
            ------------------------------------------------
            VECTOR → HORIZONTAL
            ------------------------------------------------
            */

            const altura =
                aGrados(
                    Math.asin(
                        Math.max(
                            -1,
                            Math.min(
                                1,
                                vz
                            )
                        )
                    )
                );


            let azimut =
                aGrados(
                    Math.atan2(
                        vx,
                        vy
                    )
                );


            azimut =
                normalizar(
                    azimut
                );


            /*
            ------------------------------------------------
            HORIZONTAL → ECUATORIAL
            ------------------------------------------------
            */

            const ecuatorial =
                horizontalAEcuatorial(
                    azimut,
                    altura,
                    sideral
                );


            /*
            ------------------------------------------------
            ECUATORIAL → VECTOR
            ------------------------------------------------
            */

            const ecuatorialVector =
                ecuatorialAVector(
                    ecuatorial.ra,
                    ecuatorial.dec
                );


            /*
            ------------------------------------------------
            ECUATORIAL → GALÁCTICO
            ------------------------------------------------
            */

            const galactico =
                ecuatorialAGalactico(
                    ecuatorialVector.x,
                    ecuatorialVector.y,
                    ecuatorialVector.z
                );


            /*
            ------------------------------------------------
            GALÁCTICO → MAPA GAIA
            ------------------------------------------------
            */

            const uv =
                galacticoAImagen(
                    galactico
                );


            const pixel =
                obtenerPixel(
                    uv.u,
                    uv.v
                );


            if (!pixel) {

                indice += 4;

                continue;
            }


            /*
            ------------------------------------------------
            BRILLO
            ------------------------------------------------
            */

            const brillo =
                (
                    pixel.r +
                    pixel.g +
                    pixel.b
                ) / 765;


            /*
            En AR queremos que la imagen
            sea sutil.

            En modo libre puede ser mucho más
            visible.
            */

            let alpha;


            if (
                estado.modo === "libre"
            ) {

                alpha =
                    255;

            } else {

                alpha =
                    Math.max(
                        0,
                        Math.min(
                            190,
                            (
                                brillo -
                                0.03
                            ) * 900
                        )
                    );
            }


            datos[indice++] =
                pixel.r;

            datos[indice++] =
                pixel.g;

            datos[indice++] =
                pixel.b;

            datos[indice++] =
                alpha;
        }
    }


    contexto.putImageData(
        imagen,
        0,
        0
    );


    /*
    ------------------------------------------------
    DIBUJAR SOBRE EL RENDERER
    ------------------------------------------------
    */

    ctx.save();

    ctx.imageSmoothingEnabled =
        true;


    ctx.globalCompositeOperation =
        "screen";


    ctx.drawImage(
        canvas,
        0,
        0,
        innerWidth,
        innerHeight
    );


    ctx.restore();
}
