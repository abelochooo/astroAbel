const $=id=>document.getElementById(id),canvas=$("cieloCamara"),ctx=canvas.getContext("2d");

const UI={
 mensaje:$("ubicacionMensaje"),ubicacion:$("ubicacionUsuario"),pantalla:$("ubicacionDiv"),
 direccion:$("direccion"),altitud:$("altitud"),debug:$("debug"),camara:$("camara"),
 error:$("errorCamara"),activar:$("activar"),calibrar:$("calibrar"),modo:$("modoBoton"),
 fov:$("fovSlider"),fovTexto:$("fovValor")
};

let lat,lon,estrellas=[],constelaciones=[],cuerpos=[];
let modo="ar",heading=0,pitch=0,roll=0;
let beta0=null,ultimoBeta=null;
let fovH=Number(localStorage.getItem("fovH"))||66,fovV=50;
let pendiente=false,arrastrando=false;
let inicioX=0,inicioY=0,inicioH=0,inicioP=0;
let sensores=false;

const rad=x=>x*Math.PI/180;
const deg=x=>x*180/Math.PI;
const norm=x=>(x%360+360)%360;
const lim=(x,a,b)=>Math.max(a,Math.min(b,x));
const dif=(a,b)=>(a-b+540)%360-180;
const suav=(a,b,f)=>norm(a+dif(b,a)*f);

function render(){
 if(pendiente)return;
 pendiente=true;
 requestAnimationFrame(()=>{pendiente=false;dibujar()});
}

function cargar(a){
 return fetch(a).then(r=>{
  if(!r.ok)throw Error(a);
  return r.json();
 });
}

async function ciudad(lat,lon){
 try{
  const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
  const a=(await r.json()).address||{};
  return `${a.city||a.town||a.village||a.municipality||a.county||"Ubicación desconocida"}, ${a.country||""}`;
 }catch(e){return"Ubicación obtenida"}
}

function ubicacion(){
 if(!navigator.geolocation)return;
 navigator.geolocation.getCurrentPosition(async p=>{
  lat=p.coords.latitude;
  lon=p.coords.longitude;
  UI.ubicacion.textContent=await ciudad(lat,lon);

  try{
   [estrellas,constelaciones]=await Promise.all([
    cargar("estrellas.json"),cargar("constelaciones.json")
   ]);
  }catch(e){console.error(e)}

  planetas();
  render();
  setInterval(planetas,30000);
  setTimeout(()=>UI.pantalla?.remove(),2500);
 },e=>{
  UI.mensaje.textContent="No se pudo obtener tu ubicación";
  UI.ubicacion.textContent=e.message;
  setTimeout(()=>UI.pantalla?.remove(),2500);
 },{
  enableHighAccuracy:true,
  timeout:10000,
  maximumAge:0
 });
}

function ra(v){
 if(typeof v!=="string")return null;
 const p=v.match(/(\d+)h\s*(\d+)m\s*([\d.]+)s/i);
 return p?(+p[1]+p[2]/60+p[3]/3600)*15:null;
}

function dec(v){
 if(typeof v!=="string")return null;
 const p=v.match(/([+-])\s*(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/u);
 if(!p)return null;
 return(p[1]=="-"?-1:1)*(+p[2]+p[3]/60+p[4]/3600);
}

function lst(){
 const jd=Date.now()/86400000+2440587.5;
 const T=(jd-2451545)/36525;
 return norm(
  280.46061837+
  360.98564736629*(jd-2451545)+
  .000387933*T*T-
  T*T*T/38710000+
  lon
 );
}

function altaz(ra,dec,lst){
 let H=norm(lst-ra);
 if(H>180)H-=360;

 const L=rad(lat),D=rad(dec),h=rad(H);

 const altitude=Math.asin(lim(
  Math.sin(L)*Math.sin(D)+
  Math.cos(L)*Math.cos(D)*Math.cos(h),
  -1,1
 ));

 const azimuth=Math.atan2(
  Math.sin(h),
  Math.cos(h)*Math.sin(L)-
  Math.tan(D)*Math.cos(L)
 );

 return{
  az:norm(deg(azimuth)+180),
  alt:deg(altitude)
 };
}

function vec(az,alt){
 az=rad(az);
 alt=rad(alt);
 return{
  x:Math.cos(alt)*Math.sin(az),
  y:Math.cos(alt)*Math.cos(az),
  z:Math.sin(alt)
 };
}

function dot(a,b){
 return a.x*b.x+a.y*b.y+a.z*b.z;
}

function cross(a,b){
 return{
  x:a.y*b.z-a.z*b.y,
  y:a.z*b.x-a.x*b.z,
  z:a.x*b.y-a.y*b.x
 };
}

function unit(v){
 const n=Math.hypot(v.x,v.y,v.z)||1;
 return{x:v.x/n,y:v.y/n,z:v.z/n};
}

function camara(){
 const f=unit(vec(heading,pitch));

 let upWorld={x:0,y:0,z:1};

 if(Math.abs(dot(f,upWorld))>.985){
  upWorld={x:0,y:1,z:0};
 }

 let right=unit(cross(f,upWorld));
 let up=unit(cross(right,f));

 const r=rad(roll),c=Math.cos(r),s=Math.sin(r);
 const rr={...right},uu={...up};

 right={
  x:rr.x*c+uu.x*s,
  y:rr.y*c+uu.y*s,
  z:rr.z*c+uu.z*s
 };

 up={
  x:-rr.x*s+uu.x*c,
  y:-rr.y*s+uu.y*c,
  z:-rr.z*s+uu.z*c
 };

 return{forward:f,right,up};
}

function proyectar(az,alt,b,fx,fy,cx,cy){
 const p=vec(az,alt);
 const f=dot(p,b.forward);

 if(f<=.001)return null;

 const x=cx+fx*dot(p,b.right)/f;
 const y=cy-fy*dot(p,b.up)/f;

 if(x<-100||x>innerWidth+100||y<-100||y>innerHeight+100)
  return null;

 return{x,y};
}

const lista=[
 ["Sun","Sol"],
 ["Moon","Luna"],
 ["Mercury","Mercurio"],
 ["Venus","Venus"],
 ["Mars","Marte"],
 ["Jupiter","Júpiter"],
 ["Saturn","Saturno"]
];

function planetas(){
 if(lat==null||lon==null||typeof Astronomy==="undefined")return;

 const fecha=new Date();
 const obs=new Astronomy.Observer(lat,lon,0);

 cuerpos=lista.map(([b,n])=>{
  try{
   const e=Astronomy.Equator(
    Astronomy.Body[b],
    fecha,
    obs,
    true,
    true
   );

   const h=Astronomy.Horizon(
    fecha,
    obs,
    e.ra,
    e.dec,
    "normal"
   );

   return{
    nombre:n,
    az:h.azimuth,
    alt:h.altitude
   };
  }catch(e){
   return null;
  }
 }).filter(Boolean);

 render();
}

function estrellasDibujo(L,b,fx,fy,cx,cy){
 for(const e of estrellas){
  const r=ra(e.RA),d=dec(e.Dec);
  if(r==null||d==null)continue;

  const h=altaz(r,d,L);
  const p=proyectar(h.az,h.alt,b,fx,fy,cx,cy);
  if(!p)continue;

  const m=Number(e.V);
  if(!Number.isFinite(m))continue;

  const radio=lim(3.8-m*.45,.5,5);
  const brillo=lim(1.2-m/8,.15,1);

  ctx.beginPath();
  ctx.arc(p.x,p.y,radio,0,Math.PI*2);
  ctx.fillStyle=`rgba(255,255,255,${brillo})`;
  ctx.fill();
 }
}

function constelacionesDibujo(L,b,fx,fy,cx,cy){
 ctx.strokeStyle="rgba(120,170,255,.55)";
 ctx.lineWidth=1;
 ctx.font="13px Arial";
 ctx.fillStyle="rgba(180,210,255,.75)";

 for(const c of constelaciones){
  let nombre=null;

  for(const linea of c.lineas||[]){
   ctx.beginPath();
   let ok=false;

   for(let i=0;i<linea.length-1;i++){
    const a=altaz(linea[i][0],linea[i][1],L);
    const d=altaz(linea[i+1][0],linea[i+1][1],L);

    const p1=proyectar(a.az,a.alt,b,fx,fy,cx,cy);
    const p2=proyectar(d.az,d.alt,b,fx,fy,cx,cy);

    if(!p1||!p2)continue;

    ctx.moveTo(p1.x,p1.y);
    ctx.lineTo(p2.x,p2.y);

    nombre??=p1;
    ok=true;
   }

   if(ok)ctx.stroke();
  }

  if(nombre)
   ctx.fillText(c.nombre||"",nombre.x+6,nombre.y-6);
 }
}

function cuerposDibujo(b,fx,fy,cx,cy){
 const size={
  Sol:16,Luna:13,"Júpiter":8,
  Saturno:7,Venus:6,Marte:5,Mercurio:4
 };

 const color={
  Sol:"#fff0a0",Luna:"#e8e8e0",
  "Júpiter":"#e8c28c",Saturno:"#ead6a0",
  Venus:"#fff0b0",Marte:"#e77d52",
  Mercurio:"#bdb7a8"
 };

 ctx.textAlign="center";
 ctx.font="13px Arial";

 for(const c of cuerpos){
  const p=proyectar(c.az,c.alt,b,fx,fy,cx,cy);
  if(!p)continue;

  const r=size[c.nombre]||5;

  ctx.beginPath();
  ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle=color[c.nombre]||"#ffd27f";
  ctx.fill();

  ctx.fillStyle="rgba(255,255,255,.9)";
  ctx.fillText(c.nombre,p.x,p.y-r-6);
 }

 ctx.textAlign="left";
}

function dibujar(){
 if(lat==null||lon==null)return;

 const w=innerWidth,h=innerHeight;
 const cx=w/2,cy=h/2;

 ctx.clearRect(0,0,w,h);

 const b=camara(),L=lst();

 const fx=cx/Math.tan(rad(fovH)/2);
 const fy=cy/Math.tan(rad(fovV)/2);

 constelacionesDibujo(L,b,fx,fy,cx,cy);
 estrellasDibujo(L,b,fx,fy,cx,cy);
 cuerposDibujo(b,fx,fy,cx,cy);
}

function sensoresIOS(){
 if(sensores)return;
 sensores=true;

 window.addEventListener("deviceorientation",e=>{
  if(modo!=="ar")return;
  if(e.alpha==null||e.beta==null||e.gamma==null)return;

  ultimoBeta=e.beta;

  let h;

  if(typeof e.webkitCompassHeading==="number"){
   h=e.webkitCompassHeading;
  }else{
   h=360-e.alpha;
  }

  h=norm(h);

  if(beta0===null)beta0=e.beta;

  const p=lim(e.beta-beta0,-89,89);
  const r=lim(e.gamma,-90,90);

  heading=suav(heading,h,.18);
  pitch+=(p-pitch)*.15;
  roll+=(r-roll)*.08;

  UI.direccion.textContent=`${heading.toFixed(1)}°`;
  UI.altitud.textContent=`${pitch.toFixed(1)}°`;
  UI.debug.textContent=
   `α:${e.alpha.toFixed(0)} β:${e.beta.toFixed(0)} γ:${e.gamma.toFixed(0)}`;

  render();
 },true);
}

function calibrar(){
 if(ultimoBeta==null){
  alert("Activa los sensores primero.");
  return;
 }

 beta0=ultimoBeta;
 pitch=0;

 UI.altitud.textContent="0°";
 render();
}

function cambiarModo(){
 modo=modo==="ar"?"libre":"ar";
 document.body.classList.toggle("modo-libre",modo==="libre");

 UI.modo.textContent=
  modo==="ar"?"Modo mapa libre":"Modo cámara (AR)";

 render();
}

canvas.addEventListener("pointerdown",e=>{
 if(modo!=="libre")return;

 arrastrando=true;
 inicioX=e.clientX;
 inicioY=e.clientY;
 inicioH=heading;
 inicioP=pitch;

 canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener("pointermove",e=>{
 if(!arrastrando)return;

 heading=norm(
  inicioH-
  (e.clientX-inicioX)*fovH/innerWidth
 );

 pitch=lim(
  inicioP-
  (e.clientY-inicioY)*fovV/innerHeight,
  -89,89
 );

 UI.direccion.textContent=`${heading.toFixed(1)}°`;
 UI.altitud.textContent=`${pitch.toFixed(1)}°`;

 render();
});

window.addEventListener("pointerup",()=>arrastrando=false);

function actualizarFOV(){
 if(!innerWidth)return;

 fovV=2*deg(Math.atan(
  Math.tan(rad(fovH)/2)*
  innerHeight/innerWidth
 ));
}

if(UI.fov){
 UI.fov.value=fovH;
 actualizarFOV();

 UI.fov.addEventListener("input",()=>{
  fovH=Number(UI.fov.value);
  localStorage.setItem("fovH",fovH);
  actualizarFOV();

  if(UI.fovTexto)
   UI.fovTexto.textContent=`${fovH}°`;

  render();
 });
}

if(UI.fovTexto)
 UI.fovTexto.textContent=`${fovH}°`;

async function iniciarCamara(){
 if(!navigator.mediaDevices?.getUserMedia){
  UI.error.textContent="La cámara no está disponible en este navegador.";
  UI.error.style.display="block";
  return;
 }

 try{
  const stream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode:{exact:"environment"}},
   audio:false
  });

  UI.camara.srcObject=stream;
  UI.camara.play?.();
 }catch(e){
  UI.error.textContent=`No se pudo iniciar la cámara: ${e.name}`;
  UI.error.style.display="block";
 }
}

UI.activar?.addEventListener("click",async()=>{
 try{
  if(typeof DeviceOrientationEvent!=="undefined"&&
     typeof DeviceOrientationEvent.requestPermission==="function"){

   const p=await DeviceOrientationEvent.requestPermission();

   if(p!=="granted"){
    UI.debug.textContent="Permiso de sensores denegado.";
    return;
   }
  }

  sensoresIOS();
  UI.activar.textContent="Sensores activados";
 }catch(e){
  UI.debug.textContent="No se pudieron activar los sensores.";
 }
});

UI.calibrar?.addEventListener("click",calibrar);
UI.modo?.addEventListener("click",cambiarModo);

function canvasSize(){
 const dpr=Math.min(devicePixelRatio||1,2);

 canvas.width=innerWidth*dpr;
 canvas.height=innerHeight*dpr;

 canvas.style.width=`${innerWidth}px`;
 canvas.style.height=`${innerHeight}px`;

 ctx.setTransform(dpr,0,0,dpr,0,0);

 actualizarFOV();
 render();
}

window.addEventListener("resize",canvasSize);

function escribir(){
 const t="Tu ubicación es";
 let i=0;

 UI.mensaje.textContent="";

 const x=setInterval(()=>{
  if(i>=t.length){
   clearInterval(x);
   ubicacion();
   return;
  }

  UI.mensaje.textContent+=t[i++];
 },60);
}

canvasSize();
escribir();
iniciarCamara();