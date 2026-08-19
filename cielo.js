const canvas = document.getElementById("cielo");
const ctx = canvas.getContext("2d");

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

ctx.fillStyle = "white";

ctx.beginPath();
ctx.arc(
    canvas.width / 2,
    canvas.height / 2,
    5,
    0,
    Math.PI * 2
);
ctx.fill();