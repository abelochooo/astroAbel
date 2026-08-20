const camara =
    document.getElementById(
        "camara"
    );

const errorCamara =
    document.getElementById(
        "errorCamara"
    );


export async function iniciarCamara() {

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        errorCamara.textContent =
            "La cámara no está disponible.";

        errorCamara.style.display =
            "block";

        return;
    }

    try {

        const stream =
            await navigator.mediaDevices
                .getUserMedia({
                    video: {
                        facingMode: {
                            ideal: "environment"
                        }
                    },

                    audio: false
                });

        camara.srcObject =
            stream;

        await camara.play?.();

    } catch (error) {

        console.error(error);

        errorCamara.textContent =
            `No se pudo iniciar la cámara: ${error.name}`;

        errorCamara.style.display =
            "block";
    }
}


export function detenerCamara() {

    const stream =
        camara.srcObject;

    if (!stream) {
        return;
    }

    stream
        .getTracks()
        .forEach(track => {
            track.stop();
        });

    camara.srcObject =
        null;
}
