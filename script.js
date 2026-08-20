const $=id=>document.getElementById(id);
const canvas=$("cieloCamara"),ctx=canvas.getContext("2d");
const UI={
mensaje:$("ubicacionMensaje"),ubicacion:$("ubicacionUsuario"),
pantalla:$("ubicacionDiv"),direccion:$("direccion"),altitud:$("altitud"),
debug:$("debug"),camara:$("camara"),error:$("errorCamara"),
activar:$("activar"),calibrar:$("calibrar"),modo:$("modoBoton"),
fov:$("fovSlider"),fovTexto:$("fovValor")
};

let lat,lon,estrellas=[],constelaciones=[],cuerpos=[];
let modo="ar",heading=0,pitch=0,roll=0;
let ultimoBeta=null,betaReferencia=null,sensoresActivados=false;
let fovH=Number(localStorage.getItem("fovH"))||66,fovV=50;
let renderPendiente=false,arrastrando=false,inicioX=0,inicioY=0,inicioHeading=0,inicioPitch=0;
let objetivo=null;

const rad=x=>x*Math.PI/180;
const deg=x=>x*180/Math.PI;
const normalizar=x=>((x%360)+360)%360;
const limitar=(x,a,b)=>Math.max(a,Math.min(b,x));
const diferenciaAngular=(a,b)=>((a-b+540)%360)-180;
const suavizar=(a,b,f)=>normalizar(a+diferenciaAngular(b,a)*f);

function render(){
 if(renderPendiente)return;
 renderPendiente=true;
 requestAnimationFrame(()=>{renderPendiente=false;dibujarCielo()});
}

async function cargar(a){
 const r=await fetch(a);
 if(!r.ok)throw Error(a);
 return r.json();
}

async function obtenerCiudad(a,b){
 try{
  const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${a}&lon=${b}&format=json`);
  const d=await r.json(),x=d.address||{};
  return `${x.city||x.town||x.village||x.municipality||x.county||"Ubicación desconocida"}, ${x.country||""}`;
 }catch{return"Ubicación obtenida"}
}

function obtenerUbicacion(){
 if(!navigator.geolocation)return;
 navigator.geolocation.getCurrentPosition(async p=>{
  lat=p.coords.latitude;
  lon=p.coords.longitude;
  UI.ubicacion.textContent=await obtenerCiudad(lat,lon);
  try{
   [estrellas,constelaciones]=await Promise.all([
    cargar("estrellas.json"),cargar("constelaciones.json")
   ]);
  }catch(e){console.error(e)}
  actualizarPlanetas();
  setInterval(actualizarPlanetas,30000);
  setTimeout(()=>UI.pantalla?.remove(),2500);
 },e=>{
  UI.ubicacion.textContent=`Error ${e.code}: ${e.message}`;
  setTimeout(()=>UI.pantalla?.remove(),2500);
 },{enableHighAccuracy:true,timeout:10000,maximumAge:0});
}

function raGrados(x){
 if(typeof x!=="string")return null;
 const p=x.match(/(\d+)h\s*(\d+)m\s*([\d.]+)s/i);
 return p?(+p[1]+p[2]/60+p[3]/3600)*15:null;
}

function decGrados(x){
 if(typeof x!=="string")return null;
 const p=x.match(/([+-])\s*(\d+)[°º]\s*(\d+)[′']\s*(\d+(?:\.\d+)?)[″"]/u);
 if(!p)return null;
 return(p[1]==="-"?-1:1)*(+p[2]+p[3]/60+p[4]/3600);
}

function tiempoSideral(){
 const jd=Date.now()/86400000+2440587.5;
 const T=(jd-2451545)/36525;
 return normalizar(
  280.46061837+
  360.98564736629*(jd-2451545)+
  .000387933*T*T-T*T*T/38710000+lon
 );
}

function altAz(ra,dec,lst){
 let H=normalizar(lst-ra);
 if(H>180)H-=360;
 const L=rad(lat),D=rad(dec),h=rad(H);
 const alt=Math.asin(limitar(
  Math.sin(L)*Math.sin(D)+Math.cos(L)*Math.cos(D)*Math.cos(h),-1,1
 ));
 const az=Math.atan2(
  Math.sin(h),
  Math.cos(h)*Math.sin(L)-Math.tan(D)*Math.cos(L)
 );
 return{az:normalizar(deg(az)+180),alt:deg(alt)};
}

function vector(az,alt){
 az=rad(az);alt=rad(alt);
 return{
  x:Math.cos(alt)*Math.sin(az),
  y:Math.cos(alt)*Math.cos(az),
  z:Math.sin(alt)
 };
}

function dot(a,b){return a.x*b.x+a.y*b.y+a.z*b.z}

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

function baseCamara(){
 const f=vector(heading,pitch);
 let r=unit(cross(f,{x:0,y:0,z:1}));
 if(Math.hypot(r.x,r.y)<.001)r=unit(cross(f,{x:1,y:0,z:0}));
 const u=unit(cross(r,f));
 return{forward:f,right:r,up:u};
}

function proyectar(az,alt,b,fx,fy,cx,cy){
 const p=vector(az,alt);
 const f=dot(p,b.forward);
 if(f<=.001)return null;
 const x=cx+fx*dot(p,b.right)/f;
 const y=cy-fy*dot(p,b.up)/f;
 if(x<-150||x>innerWidth+150||y<-150||y>innerHeight+150)return null;
 return{x,y};
}

const planetas=[
 ["Sun","Sol"],["Moon","Luna"],["Mercury","Mercurio"],
 ["Venus","Venus"],["Mars","Marte"],["Jupiter","Júpiter"],["Saturn","Saturno"]
];

function actualizarPlanetas(){
 if(lat===undefined||lon===undefined||typeof Astronomy==="undefined")return;
 const ahora=new Date(),obs=new Astronomy.Observer(lat,lon,0);
 cuerpos=planetas.map(([body,nombre])=>{
  try{
   const e=Astronomy.Equator(Astronomy.Body[body],ahora,obs,true,true);
   const h=Astronomy.Horizon(ahora,obs,e.ra,e.dec,"normal");
   return{nombre,az:normalizar(h.azimuth),alt:h.altitude};
  }catch{return null}
 }).filter(Boolean);
 render();
}

function dibujarEstrellas(lst,b,fx,fy,cx,cy){
 for(const e of estrellas){
  const ra=raGrados(e.RA),dec=decGrados(e.Dec);
  if(ra===null||dec===null)continue;
  const h=altAz(ra,dec,lst);
  const p=proyectar(h.az,h.alt,b,fx,fy,cx,cy);
  if(!p)continue;
  const mag=Number(e.V);
  if(!Number.isFinite(mag))continue;
  const r=limitar(3.8-mag*.45,.5,5);
  ctx.beginPath();
  ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle=`rgba(255,255,255,${limitar(1.2-mag/8,.15,1)})`;
  ctx.fill();
 }
}

function dibujarConstelaciones(lst,b,fx,fy,cx,cy){
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
    const a=altAz(linea[i][0],linea[i][1],lst);
    const z=altAz(linea[i+1][0],linea[i+1][1],lst);
    const p1=proyectar(a.az,a.alt,b,fx,fy,cx,cy);
    const p2=proyectar(z.az,z.alt,b,fx,fy,cx,cy);
    if(!p1||!p2)continue;
    ctx.moveTo(p1.x,p1.y);
    ctx.lineTo(p2.x,p2.y);
    nombre??=p1;
    ok=true;
   }
   if(ok)ctx.stroke();
  }
  if(nombre)ctx.fillText(c.nombre||"",nombre.x+6,nombre.y-6);
 }
}

function dibujarCuerpos(b,fx,fy,cx,cy){
 const tamaños={Sol:16,Luna:13,Júpiter:8,Saturno:7,Venus:6,Marte:5,Mercurio:4};
 const colores={
  Sol:"#fff0a0",Luna:"#e8e8e0",Júpiter:"#e8c28c",
  Saturno:"#ead6a0",Venus:"#fff0b0",Marte:"#e77d52",Mercurio:"#bdb7a8"
 };
 ctx.textAlign="center";
 ctx.font="13px Arial";
 for(const c of cuerpos){
  const p=proyectar(c.az,c.alt,b,fx,fy,cx,cy);
  if(!p)continue;
  const r=tamaños[c.nombre]||5;
  ctx.beginPath();
  ctx.arc(p.x,p.y,r,0,Math.PI*2);
  ctx.fillStyle=colores[c.nombre]||"#ffd27f";
  ctx.fill();
  ctx.fillStyle="rgba(255,255,255,.9)";
  ctx.fillText(c.nombre,p.x,p.y-r-6);
 }
 ctx.textAlign="left";
}

function dibujarObjetivo(b,fx,fy,cx,cy){
 if(!objetivo)return;
 const p=proyectar(objetivo.az,objetivo.alt,b,fx,fy,cx,cy);
 if(p){
  ctx.beginPath();
  ctx.arc(p.x,p.y,25,0,Math.PI*2);
  ctx.strokeStyle="#00ff88";
  ctx.lineWidth=3;
  ctx.stroke();
  ctx.fillStyle="#00ff88";
  ctx.font="bold 15px Arial";
  ctx.textAlign="center";
  ctx.fillText(`Encontrar: ${objetivo.nombre}`,p.x,p.y-32);
  ctx.textAlign="left";
 }else{
  const da=diferenciaAngular(objetivo.az,heading);
  const dp=objetivo.alt-pitch;
  ctx.fillStyle="#00ff88";
  ctx.font="bold 18px Arial";
  ctx.textAlign="center";
  ctx.fillText(
   `${Math.abs(Math.round(da))}° ${da>0?"→":"←"}  ${Math.abs(Math.round(dp))}° ${dp>0?"↑":"↓"}`,
   innerWidth/2,innerHeight-70
  );
  ctx.textAlign="left";
 }
}

function dibujarCielo(){
 if(lat===undefined||lon===undefined)return;
 const w=innerWidth,h=innerHeight,cx=w/2,cy=h/2;
 ctx.clearRect(0,0,w,h);
 const b=baseCamara(),lst=tiempoSideral();
 const fx=cx/Math.tan(rad(fovH)/2);
 const fy=cy/Math.tan(rad(fovV)/2);
 dibujarConstelaciones(lst,b,fx,fy,cx,cy);
 dibujarEstrellas(lst,b,fx,fy,cx,cy);
 dibujarCuerpos(b,fx,fy,cx,cy);
 dibujarObjetivo(b,fx,fy,cx,cy);
}

function activarSensores(){
 if(sensoresActivados)return;
 sensoresActivados=true;
 window.addEventListener("deviceorientation",e=>{
  if(modo!=="ar"||e.beta===null||e.gamma===null)return;
  ultimoBeta=e.beta;

  let nuevoHeading;
  if(typeof e.webkitCompassHeading==="number"){
   nuevoHeading=normalizar(e.webkitCompassHeading);
  }else if(e.absolute&&e.alpha!==null){
   nuevoHeading=normalizar(360-e.alpha);
  }else return;

  const ref=betaReferencia??90;
  const nuevoPitch=limitar(e.beta-ref,-89,89);

  const vertical=Math.abs(nuevoPitch);
  const factorHeading=vertical>70?.025:vertical>50?.08:.15;

  heading=suavizar(heading,nuevoHeading,factorHeading);
  pitch+=(nuevoPitch-pitch)*.12;
  roll+=(limitar(e.gamma,-45,45)-roll)*.08;

  UI.direccion.textContent=`${heading.toFixed(1)}°`;
  UI.altitud.textContent=`${pitch.toFixed(1)}°`;
  UI.debug.textContent=`α:${Math.round(e.alpha||0)} β:${Math.round(e.beta)} γ:${Math.round(e.gamma)}`;
  render();
 },true);
}

function calibrar(){
 if(ultimoBeta===null)return alert("Activa los sensores primero.");
 betaReferencia=ultimoBeta;
 pitch=0;
 UI.altitud.textContent="0°";
 render();
}

function actualizarFOV(){
 if(!innerWidth)return;
 fovV=2*deg(Math.atan(Math.tan(rad(fovH)/2)*innerHeight/innerWidth));
}

function cambiarModo(){
 modo=modo==="ar"?"libre":"ar";
 document.body.classList.toggle("modo-libre",modo==="libre");
 UI.modo.textContent=modo==="ar"?"Modo mapa libre":"Modo cámara (AR)";
 render();
}

function encontrarObjeto(){
 const nombres=cuerpos.map(x=>x.nombre);
 const texto=prompt(
  `Objeto a encontrar:\n${nombres.join(", ")}`
 );
 if(!texto)return;
 const buscado=texto.toLowerCase().trim();
 const encontrado=cuerpos.find(x=>x.nombre.toLowerCase()===buscado);
 if(!encontrado){
  alert("No encuentro ese objeto en la lista.");
  return;
 }
 objetivo=encontrado;
 render();
}

const buscar=document.createElement("button");
buscar.textContent="Encontrar objeto";
buscar.style.cssText="position:fixed;bottom:25px;left:50%;transform:translateX(-50%);z-index:20;padding:12px 18px;border:0;border-radius:20px;background:#111;color:white;font-size:15px";
buscar.onclick=encontrarObjeto;
document.body.appendChild(buscar);

canvas.addEventListener("pointerdown",e=>{
 if(modo!=="libre")return;
 arrastrando=true;
 inicioX=e.clientX;
 inicioY=e.clientY;
 inicioHeading=heading;
 inicioPitch=pitch;
 canvas.setPointerCapture?.(e.pointerId);
});

canvas.addEventListener("pointermove",e=>{
 if(!arrastrando)return;
 heading=normalizar(inicioHeading-(e.clientX-inicioX)*fovH/innerWidth);
 pitch=limitar(inicioPitch-(e.clientY-inicioY)*fovV/innerHeight,-85,85);
 render();
});

window.addEventListener("pointerup",()=>arrastrando=false);

async function iniciarCamara(){
 if(!navigator.mediaDevices?.getUserMedia){
  UI.error.textContent="La cámara no está disponible.";
  UI.error.style.display="block";
  return;
 }
 try{
  const stream=await navigator.mediaDevices.getUserMedia({
   video:{facingMode:{ideal:"environment"}},
   audio:false
  });
  UI.camara.srcObject=stream;
  await UI.camara.play?.();
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
   if(p!=="granted")return;
  }
  activarSensores();
  UI.activar.textContent="Sensores activados";
 }catch{
  UI.debug.textContent="No se pudieron activar los sensores.";
 }
});

UI.calibrar?.addEventListener("click",calibrar);
UI.modo?.addEventListener("click",cambiarModo);

UI.fov?.addEventListener("input",()=>{
 fovH=Number(UI.fov.value);
 localStorage.setItem("fovH",fovH);
 actualizarFOV();
 if(UI.fovTexto)UI.fovTexto.textContent=`${fovH}°`;
 render();
});

function ajustarCanvas(){
 const dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=innerWidth*dpr;
 canvas.height=innerHeight*dpr;
 canvas.style.width=`${innerWidth}px`;
 canvas.style.height=`${innerHeight}px`;
 ctx.setTransform(dpr,0,0,dpr,0,0);
 actualizarFOV();
 render();
}

window.addEventListener("resize",ajustarCanvas);

function escribir(){
 const texto="Tu ubicación es";
 let i=0;
 UI.mensaje.textContent="";
 const t=setInterval(()=>{
  if(i>=texto.length){
   clearInterval(t);
   obtenerUbicacion();
   return;
  }
  UI.mensaje.textContent+=texto[i++];
 },60);
}

fovV=50;
if(UI.fov)UI.fov.value=fovH;
if(UI.fovTexto)UI.fovTexto.textContent=`${fovH}°`;
ajustarCanvas();
escribir();
iniciarCamara();