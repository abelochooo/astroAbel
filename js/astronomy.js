import { estado } from "./state.js";
import {
    aRadianes,
    aGrados,
    normalizar,
    limitar
} from "./utils.js";

export async function cargarArchivo(nombre) {
    const respuesta = await fetch(nombre);

    if (!respuesta.ok) {
        throw new Error("No se pudo cargar " + nombre);
    }

    return await respuesta.json();
}

export async function cargarDatosAstronomicos() {
    try {
        const datos = await Promise.all([
            cargarArchivo("estrellas.json"),
            cargarArchivo("constelaciones.json")
        ]);

        estado.estrellas = datos[0];
        estado.constelaciones = datos[1];
    } catch (error) {
        console.error("Error cargando los archivos:", error);
    }
}

export function convertirRA(ra) {
    if (typeof ra !== "string") {
        return null;
    }

    const partes = ra.match(/(\d+)h\s*(\d+)m\s*([\d.]+)s/i);

    if (!partes) {
        return null;
    }

    const horas = Number(partes[1]);
    const minutos = Number(partes[2]);
    const segundos = Number(partes[3]);

    return (horas + minutos / 60 + segundos / 3600) * 15;
}

export function convertirDec(dec) {
    if (typeof dec !== "string") {
        return null;
    }

    const partes = dec.match(
        /([+-])\s*(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/u
    );

    if (!partes) {
        return null;
    }

    const signo = partes[1] === "-" ? -1 : 1;

    const grados = Number(partes[2]);
    const minutos = Number(partes[3]);
    const segundos = Number(partes[4]);

    return signo * (
        grados +
        minutos / 60 +
        segundos / 3600
    );
}

export function tiempoSideral() {
    const fechaJuliana =
        Date.now() / 86400000 + 2440587.5;

    const siglos =
        (fechaJuliana - 2451545) / 36525;

    const hora =
        280.46061837 +
        360.98564736629 * (fechaJuliana - 2451545) +
        0.000387933 * siglos * siglos -
        siglos * siglos * siglos / 38710000;

    return normalizar(hora + estado.longitud);
}

export function calcularAltura(ra, dec, horaSideral) {
    let hora = normalizar(horaSideral - ra);

    if (hora > 180) {
        hora -= 360;
    }

    const lat = aRadianes(estado.latitud);
    const declinacion = aRadianes(dec);
    const h = aRadianes(hora);

    const altura = Math.asin(
        limitar(
            Math.sin(lat) * Math.sin(declinacion) +
            Math.cos(lat) *
            Math.cos(declinacion) *
            Math.cos(h),
            -1,
            1
        )
    );

    const azimut = Math.atan2(
        Math.sin(h),
        Math.cos(h) * Math.sin(lat) -
        Math.tan(declinacion) * Math.cos(lat)
    );

    return {
        azimut: normalizar(aGrados(azimut) + 180),
        altura: aGrados(altura)
    };
}

const listaPlanetas = [
    ["Sun", "Sol"],
    ["Moon", "Luna"],
    ["Mercury", "Mercurio"],
    ["Venus", "Venus"],
    ["Mars", "Marte"],
    ["Jupiter", "Júpiter"],
    ["Saturn", "Saturno"]
];

export function calcularPlanetas() {
    if (
        estado.latitud === null ||
        estado.longitud === null ||
        typeof Astronomy === "undefined"
    ) {
        return;
    }

    const ahora = new Date();

    const observador = new Astronomy.Observer(
        estado.latitud,
        estado.longitud,
        0
    );

    estado.planetas = listaPlanetas
        .map(([nombreIngles, nombre]) => {
            try {
                const posicion = Astronomy.Equator(
                    Astronomy.Body[nombreIngles],
                    ahora,
                    observador,
                    true,
                    true
                );

                const cielo = Astronomy.Horizon(
                    ahora,
                    observador,
                    posicion.ra,
                    posicion.dec,
                    "normal"
                );

                const resultado = {
    nombre: nombre,
    azimut: normalizar(cielo.azimuth),
    altura: cielo.altitude
};

if (nombreIngles === "Moon") {
    const fase = calcularFaseLunar(ahora);

    resultado.fraccionIluminada =
        fase.fraccionIluminada;

    resultado.elongacion =
        fase.elongacion;
}

return resultado;

            } catch (error) {
                console.error(error);
                return null;
            }
        })
        .filter(planeta => planeta !== null);

    if (estado.objetoBuscado) {
        const nuevoObjeto = estado.planetas.find(
            planeta =>
                planeta.nombre === estado.objetoBuscado.nombre
        );

        if (nuevoObjeto) {
            estado.objetoBuscado = nuevoObjeto;
        }
    }
}

export function iniciarActualizacionPlanetas(actualizarPantalla) {
    if (estado.intervaloPlanetas) {
        return;
    }

    estado.intervaloPlanetas = setInterval(() => {
        calcularPlanetas();
        actualizarPantalla();
    }, 30000);
}

export function calcularFaseLunar(fecha) {
    const iluminacion = Astronomy.Illumination(
        "Moon",
        fecha
    );

    const elongacion =
        Astronomy.AngleFromSun(
            "Moon",
            fecha
        );

    return {
        fraccionIluminada:
            iluminacion.phase_fraction,

        elongacion:
            elongacion
    };
}

