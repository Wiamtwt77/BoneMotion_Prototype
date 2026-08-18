const c=document.getElementById("c"),ctx=c.getContext("2d");
const S={img:null,rect:null,bones:[],selected:null,region:null,drag:null,mode:"select",regions:new Map(),showOriginal:true};
const uid=()=>Math.random().toString(36).slice(2,9);
const B=(name,sx,sy,x,y)=>({id:uid(),name,sx,sy,x,y,rsx:sx,rsy:sy,rx:x,ry:y});
const P=e=>{const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}};
const start=b=>({x:b.sx,y:b.sy});
function status(t,ok=false){const e=document.getElementById("status");e.textContent=t;e.className="panel"+(ok?" ok":"")}

function render(){
 ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);
 if(S.img){
  document.getElementById("empty").style.display="none";
  if(S.showOriginal){ctx.globalAlpha=.18;ctx.drawImage(S.img,S.rect.x,S.rect.y,S.rect.w,S.rect.h);ctx.globalAlpha=1}
  for(const [id,r] of S.regions){const b=S.bones.find(q=>q.id===id);if(b)drawBound(b,r)}
  if(S.region){ctx.save();ctx.strokeStyle="#ffd15c";ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.strokeRect(S.region.x,S.region.y,S.region.w,S.region.h);ctx.restore()}
 }else document.getElementById("empty").style.display="block";
 drawBones();lists();info();selectionInfo();
}

function drawBound(b,r){
 /*
  Local deformation:
  - The bound rectangle is divided into a small mesh.
  - Its local X direction follows the REST bone.
  - Its current X direction follows the CURRENT bone.
  - Local Y distance from the bone axis is preserved.
  - Therefore moving the endpoint changes the far side of the image,
    but does NOT uniformly scale the complete image.
 */
 const C=16,R=8;
 const restA={x:b.rsx,y:b.rsy},restB={x:b.rx,y:b.ry};
 const curA={x:b.sx,y:b.sy},curB={x:b.x,y:b.y};
 const rdx=restB.x-restA.x,rdy=restB.y-restA.y;
 const cdx=curB.x-curA.x,cdy=curB.y-curA.y;
 const rlen=Math.hypot(rdx,rdy)||1,clen=Math.hypot(cdx,cdy)||1;
 const rux=rdx/rlen,ruy=rdy/rlen,rvx=-ruy,rvy=rux;
 const cux=cdx/clen,cuy=cdy/clen,cvx=-cuy,cvy=cux;

 // Region's left/right edges are allowed to extend around the bone axis.
 // Compute region vertices in rest space relative to the bone line.
 const verts=[];
 for(let j=0;j<=R;j++){
  const v=j/R;
  for(let i=0;i<=C;i++){
   const u=i/C;
   const px=r.x+r.w*u,py=r.y+r.h*v;
   const dx=px-restA.x,dy=py-restA.y;
   const along=dx*rux+dy*ruy;
   const side=dx*rvx+dy*rvy;

   // Map along proportionally to the CURRENT bone segment.
   // Side is preserved -> no uniform image scaling.
   const t=along/rlen;
   const alongNow=t*clen;
   verts.push({
     x:curA.x+cux*alongNow+cvx*side,
     y:curA.y+cuy*alongNow+cvy*side,
     u,v
   });
  }
 }

 // draw image as triangles, using affine mapping for each tiny quad
 const drawTri=(a,b,d)=>{
  const sx0=r.x+a.u*r.w,sy0=r.y+a.v*r.h;
  const sx1=r.x+b.u*r.w,sy1=r.y+b.v*r.h;
  const sx2=r.x+d.u*r.w,sy2=r.y+d.v*r.h;
  const den=(sx1-sx0)*(sy2-sy0)-(sx2-sx0)*(sy1-sy0);if(Math.abs(den)<.001)return;
  const A=((b.x-a.x)*(sy2-sy0)-(d.x-a.x)*(sy1-sy0))/den;
  const BB=((d.x-a.x)*(sx1-sx0)-(b.x-a.x)*(sx2-sx0))/den;
  const Cc=((b.y-a.y)*(sy2-sy0)-(d.y-a.y)*(sy1-sy0))/den;
  const D=((d.y-a.y)*(sx1-sx0)-(b.y-a.y)*(sx2-sx0))/den;
  const E=a.x-A*sx0-BB*sy0,F=a.y-Cc*sx0-D*sy0;
  ctx.save();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.clip();
  ctx.setTransform(A,Cc,BB,D,E,F);
  ctx.drawImage(S.img,0,0,S.img.width,S.img.height,0,0,S.rect.w,S.rect.h);
  ctx.restore();
 };
 for(let j=0;j<R;j++)for(let i=0;i<C;i++){
  const a=verts[j*(C+1)+i],b2=verts[j*(C+1)+i+1],d=verts[(j+1)*(C+1)+i+1],e=verts[(j+1)*(C+1)+i];
  drawTri(a,b2,d);drawTri(a,d,e);
 }
 ctx.save();ctx.strokeStyle=b.id===S.selected?"rgba(255,209,92,.9)":"rgba(145,125,255,.5)";ctx.lineWidth=1;ctx.strokeRect(r.x,r.y,r.w,r.h);ctx.restore();
}
function drawBones(){
 for(const b of S.bones){
  const sel=b.id===S.selected;
  ctx.strokeStyle=sel?"#ffd15c":"#907cff";ctx.lineWidth=sel?5:3;
  ctx.beginPath();ctx.moveTo(b.sx,b.sy);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.fillStyle=sel?"#ffd15c":"#9e8aff";ctx.beginPath();ctx.arc(b.sx,b.sy,5,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(b.x,b.y,9,0,Math.PI*2);ctx.fill();
  ctx.fillStyle="#eee";ctx.font="12px sans-serif";ctx.fillText(b.name,b.x+11,b.y-9);
 }
}
function lists(){const e=document.getElementById("boneList");e.innerHTML="";for(const b of S.bones){const d=document.createElement("div");d.className="bone"+(b.id===S.selected?" selected":"");d.innerHTML=`🦴 ${b.name}<br><span style="color:#757d89;font-size:10px">${S.regions.has(b.id)?"Bound":"Not bound"}</span>`;d.onclick=()=>{S.selected=b.id;render()};d.oncontextmenu=x=>{x.preventDefault();del(b.id)};e.appendChild(d)}}
function info(){const b=S.bones.find(x=>x.id===S.selected);document.getElementById("info").innerHTML=b?`<b>${b.name}</b><br>Start: ${b.sx.toFixed(0)}, ${b.sy.toFixed(0)}<br>End: ${b.x.toFixed(0)}, ${b.y.toFixed(0)}<br>Binding: ${S.regions.has(b.id)?"✓ attached":"— none"}<br><br><b>Deformation</b><br>Endpoint motion affects the far side.<br>Overall thickness is preserved.`:"No bone selected."}
function selectionInfo(){const e=document.getElementById("selectionInfo");if(!S.region){e.textContent="No region selected.";return}e.innerHTML=`X ${Math.round(S.region.x)} · Y ${Math.round(S.region.y)}<br>W ${Math.round(S.region.w)} · H ${Math.round(S.region.h)}<br><br>${S.selected?(S.regions.has(S.selected)?"Already bound.":"Click Bind Region."): "Select a bone."}`}
function del(id){S.bones=S.bones.filter(b=>b.id!==id);S.regions.delete(id);if(S.selected===id)S.selected=S.bones.at(-1)?.id||null;render()}

document.getElementById("pick").onclick=()=>document.getElementById("file").click();
document.getElementById("file").onchange=e=>{const f=e.target.files[0];if(!f)return;const im=new Image();im.onload=()=>{S.img=im;const k=Math.min(900/im.width,600/im.height,1);S.rect={x:(1100-im.width*k)/2,y:(700-im.height*k)/2,w:im.width*k,h:im.height*k};S.bones=[];S.selected=null;S.region=null;S.regions.clear();status("Image loaded. Select a region, add a bone, then bind.");render()};im.onerror=()=>status("Could not decode the image.");im.src=URL.createObjectURL(f)};
document.getElementById("boneBtn").onclick=()=>{if(!S.img)return alert("Import an image first.");S.mode="b0";document.getElementById("mode").textContent="Mode: Add Bone — click start point"};
document.getElementById("bindBtn").onclick=()=>{if(!S.selected)return alert("Select a bone first.");if(!S.region)return alert("Hold Shift and drag a region first.");S.regions.set(S.selected,{...S.region});status("✓ Bound. Move the endpoint: the region deforms along the bone axis without uniform scaling.",true);render()};
document.getElementById("deleteBtn").onclick=()=>{if(S.selected)del(S.selected)};
document.getElementById("resetBtn").onclick=()=>{for(const b of S.bones){b.x=b.rx;b.y=b.ry}render()};
document.getElementById("clearRegion").onclick=()=>{S.region=null;render()};
document.getElementById("ghost").onchange=e=>{S.showOriginal=e.target.checked;render()};

let pending=null;
c.addEventListener("mousedown",e=>{
 const p=P(e);
 if(e.shiftKey){S.drag={type:"region",sx:p.x,sy:p.y};S.region={x:p.x,y:p.y,w:0,h:0};return}
 if(S.mode==="b0"){pending=p;S.mode="b1";document.getElementById("mode").textContent="Mode: Add Bone — click endpoint";return}
 if(S.mode==="b1"){const b=B("Bone "+(S.bones.length+1),pending.x,pending.y,p.x,p.y);S.bones.push(b);S.selected=b.id;pending=null;S.mode="select";document.getElementById("mode").textContent="Mode: Select";render();return}
 const b=S.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);if(b){S.selected=b.id;S.drag={type:"bone",b,dx:p.x-b.x,dy:p.y-b.y};render()}
});
c.addEventListener("mousemove",e=>{if(!S.drag)return;const p=P(e);if(S.drag.type==="bone"){S.drag.b.x=p.x-S.drag.dx;S.drag.b.y=p.y-S.drag.dy;render();return}const x=Math.min(S.drag.sx,p.x),y=Math.min(S.drag.sy,p.y),w=Math.abs(p.x-S.drag.sx),h=Math.abs(p.y-S.drag.sy);S.region={x,y,w,h};render()});
window.addEventListener("mouseup",()=>{if(S.drag?.type==="region"&&S.region?.w>8&&S.region?.h>8)document.getElementById("mode").textContent="Mode: Region selected — click Bind Region";S.drag=null});
c.addEventListener("contextmenu",e=>{e.preventDefault();const p=P(e),b=S.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);if(b)del(b.id)});
render();
