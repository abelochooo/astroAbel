export const aRadianes = numero =>
    numero * Math.PI / 180;

export const aGrados = numero =>
    numero * 180 / Math.PI;

export function normalizar(numero) {
    return ((numero % 360) + 360) % 360;
}

export function limitar(numero, minimo, maximo) {
    return Math.max(
        minimo,
        Math.min(maximo, numero)
    );
}

export function diferenciaAngulo(a, b) {
    return ((a - b + 540) % 360) - 180;
}

export function moverSuave(
    actual,
    nuevo,
    velocidad
) {
    return normalizar(
        actual +
        diferenciaAngulo(nuevo, actual) *
        velocidad
    );
}
