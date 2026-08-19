const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");
const ubi = document.getElementById("ubi");
const transmision = await navigator.mediaDevices.getUserMedia({
    video: {
        facingMode: "enviorenment"
    }
});

const texto = "Tu ubicación es";
let i = 0;

function escribir() {
    if (i < texto.length) {
        texto1.textContent += texto[i];
        i++;
        setTimeout(escribir, 100);
    } else {
        obtenerUbicacion();
    }
}

async function obtenerUbicacion() {
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {

        const resultado = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json`
        );

        const informacion = await resultado.json();

        const { city, town, village, municipality, country } = informacion.address;

        const ciudad = city || town || village || municipality;

        ubicacion.textContent = `${ciudad}, ${country}`;


        setTimeout(() => {
            ubicacionDiv.remove();
        }, 3000);
    });
}

escribir();

ubi.textContent = ciudad;

