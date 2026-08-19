const texto1 = document.getElementById("ubicacionMensaje");
const ubicacion = document.getElementById("ubicacionUsuario");
const ubicacionDiv = document.getElementById("ubicacionDiv");
const ubi = document.getElementById("ubi");

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
        ubi.textContent = `${ciudad}, ${country}`;

        setTimeout(() => {
            ubicacionDiv.remove();
        }, 3000);
    });
}

async function iniciarCamara() {
    const transmision = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment"
        }
    });
}

escribir();
iniciarCamara();

document.getElementById("activar").addEventListener("click", async () => {

    if (typeof DeviceOrientationEvent.requestPermission === "function") {
        const permiso = await DeviceOrientationEvent.requestPermission();

        if (permiso !== "granted") return;
    }

    window.addEventListener("deviceorientationabsolute", (e) => {
        document.getElementById("alpha").textContent = e.alpha?.toFixed(1);
        document.getElementById("beta").textContent = e.beta?.toFixed(1);
        document.getElementById("gamma").textContent = e.gamma?.toFixed(1);
    });
});