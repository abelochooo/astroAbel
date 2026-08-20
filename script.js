const $=id=>document.getElementById(id);

const canvas=$("cieloCamara");
const ctx=canvas.getContext("2d");

const UI={
mensaje:$("ubicacionMensaje"),
ubicacion:$("ubicacionUsuario"),
pantalla:$("ubicacionDiv"),
direccion:$("direccion"),
altitud:$("altitud"),
debug:$("debug"),
camara:$("camara"),
error:$("errorCamara"),
activar:$("activar"),
calibrar:$("calibrar"),
modo:$("modoBoton"),
fov:$("fovSlider"),
fovTexto:$("fovValor"),
buscar:$("buscarObjeto")
};

let lat;
let lon;
let estrellas=[];
let constelaciones=[];
let cuerpos=[];

let modo="ar";
let heading=0;
let pitch=0;
let roll=0;

let ultimoBeta=null;
let betaReferencia=null;
let sensoresActivados=false;

let fovH=Number(localStorage.getItem("fovH"))||66;
let fovV=50;

let renderPendiente=false;
let arrastrando=false;

let inicioX=0;
let inicioY=0;
let inicioHeading=0;
let inicioPitch=0;

let objetivo=null;

const rad=x=>x*Math.PI/180;
const deg=x=>x*180/Math.PI;

const normalizar=x=>((x%360)+360)%360;

const limitar=(x,min,max)=>
    Math.max(min,Math.min(max,x));

const diferenciaAngular=(a,b)=>
    ((a-b+540)%360)-180;

const suavizarAngulo=(actual,nuevo,factor)=>
    normalizar(
        actual+
        diferenciaAngular(nuevo,actual)*factor
    );

function render(){

    if(renderPendiente)return;

    renderPendiente=true;

    requestAnimationFrame(()=>{

        renderPendiente=false;

        dibujarCielo();

    });
}

async function cargar(archivo){

    const respuesta=await fetch(archivo);

    if(!respuesta.ok){
        throw new Error(
            `No se pudo cargar ${archivo}`
        );
    }

    return await respuesta.json();
}

async function obtenerCiudad(lat,lon){

    try{

        const url=
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

        const respuesta=await fetch(url);

        if(!respuesta.ok){
            throw new Error("Nominatim");
        }

        const datos=await respuesta.json();

        const a=datos.address||{};

        const ciudad=
            a.city||
            a.town||
            a.village||
            a.municipality||
            a.county||
            "Ubicación desconocida";

        return `${ciudad}, ${a.country||""}`;

    }catch(error){

        console.error(error);

        return "Ubicación obtenida";
    }
}

function obtenerUbicacion(){

    if(!navigator.geolocation){

        UI.ubicacion.textContent=
            "Geolocalización no disponible.";

        return;
    }

    navigator.geolocation.getCurrentPosition(

        async ({coords})=>{

            lat=coords.latitude;
            lon=coords.longitude;

            UI.ubicacion.textContent=
                await obtenerCiudad(lat,lon);

            try{

                const resultados=
                    await Promise.all([

                        cargar("estrellas.json"),
                        cargar("constelaciones.json")

                    ]);

                estrellas=resultados[0];
                constelaciones=resultados[1];

            }catch(error){

                console.error(
                    "Error cargando JSON:",
                    error
                );
            }

            actualizarPlanetas();

            setInterval(
                actualizarPlanetas,
                30000
            );

            render();

            setTimeout(()=>{

                UI.pantalla?.remove();

            },2500);

        },

        error=>{

            UI.mensaje.textContent=
                "No se pudo obtener tu ubicación";

            UI.ubicacion.textContent=
                `Error ${error.code}: ${error.message}`;

            setTimeout(()=>{

                UI.pantalla?.remove();

            },2500);

        },

        {
            enableHighAccuracy:true,
            timeout:10000,
            maximumAge:0
        }
    );
}

function raGrados(ra){

    if(typeof ra!=="string"){
        return null;
    }

    const p=ra.match(
        /(\d+)h\s*(\d+)m\s*([\d.]+)s/i
    );

    if(!p){
        return null;
    }

    return(
        Number(p[1])+
        Number(p[2])/60+
        Number(p[3])/3600
    )*15;
}

function decGrados(dec){

    if(typeof dec!=="string"){
        return null;
    }

    const p=dec.match(
        /([+-])\s*(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/u
    );

    if(!p){
        return null;
    }

    const signo=
        p[1]==="-"?-1:1;

    return signo*(
        Number(p[2])+
        Number(p[3])/60+
        Number(p[4])/3600
    );
}

function tiempoSideral(){

    const jd=
        Date.now()/86400000+
        2440587.5;

    const T=
        (jd-2451545)/36525;

    const gmst=
        280.46061837+
        360.98564736629*
        (jd-2451545)+
        0.000387933*T*T-
        T*T*T/38710000;

    return normalizar(gmst+lon);
}

function altAz(ra,dec,lst){

    let H=
        normalizar(lst-ra);

    if(H>180){
        H-=360;
    }

    const L=rad(lat);
    const D=rad(dec);
    const h=rad(H);

    const alt=Math.asin(
        limitar(
            Math.sin(L)*Math.sin(D)+
            Math.cos(L)*
            Math.cos(D)*
            Math.cos(h),
            -1,
            1
        )
    );

    const az=Math.atan2(

        Math.sin(h),

        Math.cos(h)*Math.sin(L)-
        Math.tan(D)*Math.cos(L)

    );

    return{

        az:normalizar(deg(az)+180),
        alt:deg(alt)

    };
}

function vector(az,alt){

    az=rad(az);
    alt=rad(alt);

    return{

        x:Math.cos(alt)*Math.sin(az),
        y:Math.cos(alt)*Math.cos(az),
        z:Math.sin(alt)

    };
}

function dot(a,b){

    return(
        a.x*b.x+
        a.y*b.y+
        a.z*b.z
    );
}

function cross(a,b){

    return{

        x:a.y*b.z-a.z*b.y,
        y:a.z*b.x-a.x*b.z,
        z:a.x*b.y-a.y*b.x

    };
}

function unit(v){

    const n=
        Math.hypot(
            v.x,
            v.y,
            v.z
        )||1;

    return{

        x:v.x/n,
        y:v.y/n,
        z:v.z/n

    };
}

function baseCamara(){

    const forward=
        vector(
            heading,
            pitch
        );

    let right=
        unit(
            cross(
                forward,
                {
                    x:0,
                    y:0,
                    z:1
                }
            )
        );

    if(
        Math.hypot(
            right.x,
            right.y
        )<0.001
    ){

        right=
            unit(
                cross(
                    forward,
                    {
                        x:1,
                        y:0,
                        z:0
                    }
                )
            );
    }

    const up=
        unit(
            cross(
                right,
                forward
            )
        );

    return{
        forward,
        right,
        up
    };
}

function proyectar(
    az,
    alt,
    base,
    fx,
    fy,
    cx,
    cy
){

    const p=
        vector(
            az,
            alt
        );

    const frente=
        dot(
            p,
            base.forward
        );

    if(frente<=0.001){
        return null;
    }

    const x=
        cx+
        fx*
        dot(p,base.right)/
        frente;

    const y=
        cy-
        fy*
        dot(p,base.up)/
        frente;

    const margen=150;

    if(
        x<-margen||
        x>innerWidth+margen||
        y<-margen||
        y>innerHeight+margen
    ){

        return null;
    }

    return{x,y};
}

const planetas=[

    ["Sun","Sol"],
    ["Moon","Luna"],
    ["Mercury","Mercurio"],
    ["Venus","Venus"],
    ["Mars","Marte"],
    ["Jupiter","Júpiter"],
    ["Saturn","Saturno"]

];

function actualizarPlanetas(){

    if(
        lat===undefined||
        lon===undefined||
        typeof Astronomy==="undefined"
    ){

        return;
    }

    const ahora=new Date();

    const observador=
        new Astronomy.Observer(
            lat,
            lon,
            0
        );

    cuerpos=
        planetas
        .map(([body,nombre])=>{

            try{

                const e=
                    Astronomy.Equator(
                        Astronomy.Body[body],
                        ahora,
                        observador,
                        true,
                        true
                    );

                const h=
                    Astronomy.Horizon(
                        ahora,
                        observador,
                        e.ra,
                        e.dec,
                        "normal"
                    );

                return{

                    nombre,
                    az:normalizar(h.azimuth),
                    alt:h.altitude

                };

            }catch(error){

                console.error(error);

                return null;
            }

        })
        .filter(Boolean);

    if(objetivo){

        const nuevo=
            cuerpos.find(
                c=>
                    c.nombre===
                    objetivo.nombre
            );

        if(nuevo){
            objetivo=nuevo;
        }
    }

    render();
}

function dibujarEstrellas(
    lst,
    base,
    fx,
    fy,
    cx,
    cy
){

    for(const estrella of estrellas){

        const ra=
            raGrados(
                estrella.RA
            );

        const dec=
            decGrados(
                estrella.Dec
            );

        if(
            ra===null||
            dec===null
        ){

            continue;
        }

        const h=
            altAz(
                ra,
                dec,
                lst
            );

        const p=
            proyectar(
                h.az,
                h.alt,
                base,
                fx,
                fy,
                cx,
                cy
            );

        if(!p){
            continue;
        }

        const mag=
            Number(estrella.V);

        if(!Number.isFinite(mag)){
            continue;
        }

        const radio=
            limitar(
                3.8-mag*.45,
                .5,
                5
            );

        const brillo=
            limitar(
                1.2-mag/8,
                .15,
                1
            );

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            radio,
            0,
            Math.PI*2
        );

        ctx.fillStyle=
            `rgba(255,255,255,${brillo})`;

        ctx.fill();
    }
}

function dibujarConstelaciones(
    lst,
    base,
    fx,
    fy,
    cx,
    cy
){

    ctx.strokeStyle=
        "rgba(120,170,255,.55)";

    ctx.lineWidth=1;

    ctx.font="13px Arial";

    ctx.fillStyle=
        "rgba(180,210,255,.75)";

    for(const c of constelaciones){

        let nombrePunto=null;

        for(
            const linea of c.lineas||[]
        ){

            ctx.beginPath();

            let dibujado=false;

            for(
                let i=0;
                i<linea.length-1;
                i++
            ){

                const p1=linea[i];
                const p2=linea[i+1];

                const h1=
                    altAz(
                        p1[0],
                        p1[1],
                        lst
                    );

                const h2=
                    altAz(
                        p2[0],
                        p2[1],
                        lst
                    );

                const a=
                    proyectar(
                        h1.az,
                        h1.alt,
                        base,
                        fx,
                        fy,
                        cx,
                        cy
                    );

                const b=
                    proyectar(
                        h2.az,
                        h2.alt,
                        base,
                        fx,
                        fy,
                        cx,
                        cy
                    );

                if(!a||!b){
                    continue;
                }

                ctx.moveTo(
                    a.x,
                    a.y
                );

                ctx.lineTo(
                    b.x,
                    b.y
                );

                if(!nombrePunto){
                    nombrePunto=a;
                }

                dibujado=true;
            }

            if(dibujado){
                ctx.stroke();
            }
        }

        if(nombrePunto){

            ctx.fillText(
                c.nombre||"",
                nombrePunto.x+6,
                nombrePunto.y-6
            );
        }
    }
}

function dibujarCuerpos(
    base,
    fx,
    fy,
    cx,
    cy
){

    const tamaños={

        Sol:16,
        Luna:13,
        Júpiter:8,
        Saturno:7,
        Venus:6,
        Marte:5,
        Mercurio:4

    };

    const colores={

        Sol:"#fff0a0",
        Luna:"#e8e8e0",
        Júpiter:"#e8c28c",
        Saturno:"#ead6a0",
        Venus:"#fff0b0",
        Marte:"#e77d52",
        Mercurio:"#bdb7a8"

    };

    ctx.textAlign="center";

    ctx.font="13px Arial";

    for(const cuerpo of cuerpos){

        const p=
            proyectar(
                cuerpo.az,
                cuerpo.alt,
                base,
                fx,
                fy,
                cx,
                cy
            );

        if(!p){
            continue;
        }

        const radio=
            tamaños[cuerpo.nombre]||5;

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            radio,
            0,
            Math.PI*2
        );

        ctx.fillStyle=
            colores[cuerpo.nombre]||
            "#ffd27f";

        ctx.fill();

        ctx.fillStyle=
            "rgba(255,255,255,.9)";

        ctx.fillText(
            cuerpo.nombre,
            p.x,
            p.y-radio-6
        );
    }

    ctx.textAlign="left";
}

function dibujarObjetivo(
    base,
    fx,
    fy,
    cx,
    cy
){

    if(!objetivo){
        return;
    }

    const p=
        proyectar(
            objetivo.az,
            objetivo.alt,
            base,
            fx,
            fy,
            cx,
            cy
        );

    ctx.textAlign="center";

    if(p){

        ctx.beginPath();

        ctx.arc(
            p.x,
            p.y,
            25,
            0,
            Math.PI*2
        );

        ctx.strokeStyle=
            "#00ff88";

        ctx.lineWidth=3;

        ctx.stroke();

        ctx.fillStyle=
            "#00ff88";

        ctx.font=
            "bold 15px Arial";

        ctx.fillText(
            `🎯 ${objetivo.nombre}`,
            p.x,
            p.y-34
        );

    }else{

        const da=
            diferenciaAngular(
                objetivo.az,
                heading
            );

        const dp=
            objetivo.alt-pitch;

        ctx.fillStyle=
            "#00ff88";

        ctx.font=
            "bold 18px Arial";

        ctx.fillText(

            `${Math.abs(Math.round(da))}° ${da>0?"→":"←"}   ${Math.abs(Math.round(dp))}° ${dp>0?"↑":"↓"}`,

            innerWidth/2,
            innerHeight-80

        );
    }

    ctx.textAlign="left";
}

function dibujarCielo(){

    if(
        lat===undefined||
        lon===undefined
    ){

        return;
    }

    const w=innerWidth;
    const h=innerHeight;

    const cx=w/2;
    const cy=h/2;

    ctx.clearRect(
        0,
        0,
        w,
        h
    );

    const base=
        baseCamara();

    const lst=
        tiempoSideral();

    const fx=
        cx/
        Math.tan(
            rad(fovH)/2
        );

    const fy=
        cy/
        Math.tan(
            rad(fovV)/2
        );

    dibujarConstelaciones(
        lst,
        base,
        fx,
        fy,
        cx,
        cy
    );

    dibujarEstrellas(
        lst,
        base,
        fx,
        fy,
        cx,
        cy
    );

    dibujarCuerpos(
        base,
        fx,
        fy,
        cx,
        cy
    );

    dibujarObjetivo(
        base,
        fx,
        fy,
        cx,
        cy
    );
}

function activarSensores(){

    if(sensoresActivados){
        return;
    }

    sensoresActivados=true;

    window.addEventListener(
        "deviceorientation",
        e=>{

            if(
                modo!=="ar"||
                e.beta===null||
                e.gamma===null
            ){

                return;
            }

            ultimoBeta=e.beta;

            let nuevoHeading;

            if(
                typeof e.webkitCompassHeading===
                "number"
            ){

                nuevoHeading=
                    normalizar(
                        e.webkitCompassHeading
                    );

            }else if(
                e.absolute&&
                e.alpha!==null
            ){

                nuevoHeading=
                    normalizar(
                        360-e.alpha
                    );

            }else{

                return;
            }

            const referencia=
                betaReferencia??90;

            const nuevoPitch=
                limitar(
                    e.beta-referencia,
                    -89,
                    89
                );

            const vertical=
                Math.abs(nuevoPitch);

            let factorHeading=.15;

            if(vertical>70){
                factorHeading=.02;
            }else if(vertical>55){
                factorHeading=.05;
            }else if(vertical>40){
                factorHeading=.10;
            }

            heading=
                suavizarAngulo(
                    heading,
                    nuevoHeading,
                    factorHeading
                );

            pitch+=
                (nuevoPitch-pitch)*.12;

            roll+=
                (
                    limitar(
                        e.gamma,
                        -45,
                        45
                    )-
                    roll
                )*.08;

            UI.direccion.textContent=
                `${heading.toFixed(1)}°`;

            UI.altitud.textContent=
                `${pitch.toFixed(1)}°`;

            UI.debug.textContent=
                `α:${Math.round(e.alpha||0)} β:${Math.round(e.beta)} γ:${Math.round(e.gamma)}`;

            render();
        },
        true
    );
}

function calibrar(){

    if(ultimoBeta===null){

        alert(
            "Activa los sensores primero."
        );

        return;
    }

    betaReferencia=
        ultimoBeta;

    pitch=0;

    UI.altitud.textContent="0°";

    render();
}

function cambiarModo(){

    modo=
        modo==="ar"
        ?"libre"
        :"ar";

    document.body.classList.toggle(
        "modo-libre",
        modo==="libre"
    );

    UI.modo.textContent=
        modo==="ar"
        ?"Modo mapa libre"
        :"Modo cámara (AR)";

    render();
}

function encontrarObjeto(){

    if(!cuerpos.length){

        alert(
            "Todavía estoy calculando los objetos del cielo."
        );

        return;
    }

    const nombres=
        cuerpos
        .map(x=>x.nombre)
        .join("\n");

    const texto=
        prompt(
            `¿Qué quieres encontrar?\n\n${nombres}`
        );

    if(!texto){
        return;
    }

    const buscado=
        texto
        .toLowerCase()
        .trim();

    const encontrado=
        cuerpos.find(
            x=>
                x.nombre
                .toLowerCase()===
                buscado
        );

    if(!encontrado){

        alert(
            "No encuentro ese objeto."
        );

        return;
    }

    objetivo={
        ...encontrado
    };

    render();
}

UI.buscar?.addEventListener(
    "click",
    encontrarObjeto
);

canvas.addEventListener(
    "pointerdown",
    e=>{

        if(modo!=="libre"){
            return;
        }

        arrastrando=true;

        inicioX=e.clientX;
        inicioY=e.clientY;

        inicioHeading=heading;
        inicioPitch=pitch;

        canvas.setPointerCapture?.(
            e.pointerId
        );
    }
);

canvas.addEventListener(
    "pointermove",
    e=>{

        if(!arrastrando){
            return;
        }

        const dx=
            e.clientX-inicioX;

        const dy=
            e.clientY-inicioY;

        heading=
            normalizar(
                inicioHeading-
                dx*fovH/innerWidth
            );

        pitch=
            limitar(
                inicioPitch-
                dy*fovV/innerHeight,
                -85,
                85
            );

        UI.direccion.textContent=
            `${heading.toFixed(1)}°`;

        UI.altitud.textContent=
            `${pitch.toFixed(1)}°`;

        render();
    }
);

window.addEventListener(
    "pointerup",
    ()=>{
        arrastrando=false;
    }
);

async function iniciarCamara(){

    if(
        !navigator.mediaDevices||
        !navigator.mediaDevices.getUserMedia
    ){

        UI.error.textContent=
            "La cámara no está disponible.";

        UI.error.style.display="block";

        return;
    }

    try{

        const stream=
            await navigator.mediaDevices.getUserMedia({

                video:{
                    facingMode:{
                        ideal:"environment"
                    }
                },

                audio:false

            });

        UI.camara.srcObject=stream;

        await UI.camara.play?.();

    }catch(e){

        console.error(e);

        UI.error.textContent=
            `No se pudo iniciar la cámara: ${e.name}`;

        UI.error.style.display="block";
    }
}

UI.activar?.addEventListener(
    "click",
    async()=>{

        try{

            if(
                typeof DeviceOrientationEvent!=="undefined"&&
                typeof DeviceOrientationEvent.requestPermission===
                "function"
            ){

                const permiso=
                    await DeviceOrientationEvent
                    .requestPermission();

                if(permiso!=="granted"){

                    UI.debug.textContent=
                        "Permiso de sensores denegado.";

                    return;
                }
            }

            activarSensores();

            UI.activar.textContent=
                "Sensores activados";

        }catch(e){

            console.error(e);

            UI.debug.textContent=
                "No se pudieron activar los sensores.";
        }
    }
);

UI.calibrar?.addEventListener(
    "click",
    calibrar
);

UI.modo?.addEventListener(
    "click",
    cambiarModo
);

if(UI.fov){

    UI.fov.value=fovH;

    actualizarFOV();

    UI.fov.addEventListener(
        "input",
        ()=>{

            fovH=
                Number(
                    UI.fov.value
                );

            localStorage.setItem(
                "fovH",
                fovH
            );

            actualizarFOV();

            if(UI.fovTexto){

                UI.fovTexto.textContent=
                    `${fovH}°`;
            }

            render();
        }
    );
}

if(UI.fovTexto){

    UI.fovTexto.textContent=
        `${fovH}°`;
}

function actualizarFOV(){

    if(!innerWidth){
        return;
    }

    fovV=
        2*
        deg(
            Math.atan(
                Math.tan(
                    rad(fovH)/2
                )*
                innerHeight/
                innerWidth
            )
        );
}

function ajustarCanvas(){

    const dpr=
        Math.min(
            window.devicePixelRatio||1,
            2
        );

    canvas.width=
        innerWidth*dpr;

    canvas.height=
        innerHeight*dpr;

    canvas.style.width=
        `${innerWidth}px`;

    canvas.style.height=
        `${innerHeight}px`;

    ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
    );

    actualizarFOV();

    render();
}

window.addEventListener(
    "resize",
    ajustarCanvas
);

function escribir(){

    const texto=
        "Tu ubicación es";

    let i=0;

    UI.mensaje.textContent="";

    const timer=
        setInterval(()=>{

            if(i>=texto.length){

                clearInterval(timer);

                obtenerUbicacion();

                return;
            }

            UI.mensaje.textContent+=
                texto[i++];

        },60);
}

ajustarCanvas();

escribir();

iniciarCamara();