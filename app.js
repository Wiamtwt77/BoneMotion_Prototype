const c=document.getElementById("c"),ctx=c.getContext("2d");
const S={img:null,rect:null,bones:[],selected:null,mode:"select",region:null,drag:null,regions:new Map()};
const uid=()=>Math.random().toString(36).slice(2,9);
const B=(name,sx,sy,x,y)=>({id:uid(),name,sx,sy,x,y,rsx:sx,rsy:sy,rx:x,ry:y});
function P(e){let r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}
function render(){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,c.width,c.height);if(S.img){ctx.globalAlpha=.18;ctx.drawImage(S.img,S.rect.x,S.rect.y,S.rect.w,S.rect.h);ctx.globalAlpha=1;for(const b of S.bones){let reg=S.regions.get(b.id);if(reg)drawRegion(b,reg);else drawWholeImage();}document.getElementById("empty").style.display="none"}else document.getElementById("empty").style.display="block";drawBones();drawSelection();list();info()}
function drawWholeImage(){if(S.img&&S.bones.length===0)ctx.drawImage(S.img,S.rect.x,S.rect.y,S.rect.w,S.rect.h)}
function drawRegion(b,r){
 const sx=r.x,sy=r.y,sw=r.w,sh=r.h;
 const angle=Math.atan2(b.y-b.sy,b.x-b.sx),rest=Math.atan2(b.ry-b.rsy,b.rx-b.rsx);
 const a=angle-rest,scale=Math.max(.05,Math.hypot(b.x-b.sx,b.y-b.sy)/(Math.hypot(b.rx-b.rsx,b.ry-b.rsy)||1));
 const ox=sx+sw/2,oy=sy+sh/2;
 ctx.save();ctx.translate(ox,oy);ctx.rotate(a);ctx.scale(scale,scale);ctx.translate(-ox,-oy);
 ctx.beginPath();ctx.rect(sx,sy,sw,sh);ctx.clip();
 ctx.drawImage(S.img,0,0,S.img.width,S.img.height,S.rect.x,S.rect.y,S.rect.w,S.rect.h);
 ctx.restore();
}
function drawBones(){for(const b of S.bones){let sel=b.id===S.selected;ctx.strokeStyle=sel?"#ffd15c":"#907cff";ctx.lineWidth=sel?5:3;ctx.beginPath();ctx.moveTo(b.sx,b.sy);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.fillStyle=sel?"#ffd15c":"#9c88ff";ctx.beginPath();ctx.arc(b.sx,b.sy,5,0,7);ctx.fill();ctx.beginPath();ctx.arc(b.x,b.y,9,0,7);ctx.fill();ctx.fillStyle="#eee";ctx.font="12px sans-serif";ctx.fillText(b.name,b.x+10,b.y-10)}}
function drawSelection(){if(!S.region)return;ctx.save();ctx.strokeStyle="#ffd15c";ctx.lineWidth=2;ctx.setLineDash([7,5]);ctx.strokeRect(S.region.x,S.region.y,S.region.w,S.region.h);ctx.restore()}
function list(){let e=document.getElementById("boneList");e.innerHTML="";for(const b of S.bones){let d=document.createElement("div");d.className="bone"+(b.id===S.selected?" selected":"");d.textContent="🦴 "+b.name;d.onclick=()=>{S.selected=b.id;render()};e.appendChild(d)}}
function info(){let b=S.bones.find(x=>x.id===S.selected);document.getElementById("info").innerHTML=b?`<b>${b.name}</b><br>Start: ${b.sx.toFixed(0)}, ${b.sy.toFixed(0)}<br>End: ${b.x.toFixed(0)}, ${b.y.toFixed(0)}<br>Region: ${S.regions.has(b.id)?"Bound":"Not bound"}`:"No bone selected."}
function setStatus(t,ok=false){let e=document.getElementById("status");e.className="panel"+(ok?" ok":"");e.textContent=t}
document.getElementById("pick").onclick=()=>document.getElementById("file").click();
document.getElementById("file").onchange=e=>{let f=e.target.files[0];if(!f)return;let im=new Image();im.onload=()=>{S.img=im;let k=Math.min(900/im.width,600/im.height,1);S.rect={x:(1100-im.width*k)/2,y:(700-im.height*k)/2,w:im.width*k,h:im.height*k};S.bones=[];S.selected=null;S.region=null;S.regions.clear();setStatus("Image loaded. Add a bone, then select a region.",false);render()};im.onerror=()=>setStatus("Could not decode this image.",false);im.src=URL.createObjectURL(f)};
document.getElementById("boneBtn").onclick=()=>{if(!S.img)return alert("Import an image first.");S.mode="bone";document.getElementById("mode").textContent="Mode: Add Bone — click start, then end"};
document.getElementById("deleteBtn").onclick=()=>{if(!S.selected)return;S.bones=S.bones.filter(b=>b.id!==S.selected);S.regions.delete(S.selected);S.selected=S.bones.at(-1)?.id||null;render()};
document.getElementById("bindBtn").onclick=()=>{if(!S.selected||!S.region)return alert("Select a bone and draw a region with Shift + drag.");S.regions.set(S.selected,{...S.region});setStatus("✓ Region bound to selected bone. Drag its endpoint.",true);render()};
document.getElementById("clearSel").onclick=()=>{S.region=null;render()};
document.getElementById("resetBtn").onclick=()=>{for(const b of S.bones){b.x=b.rx;b.y=b.ry}render()};

let firstPoint=null;
c.addEventListener("mousedown",e=>{
 const p=P(e);
 if(S.mode==="bone"){if(!firstPoint){firstPoint=p;document.getElementById("mode").textContent="Mode: Add Bone — click the endpoint";return}
 const b=B("Bone "+(S.bones.length+1),firstPoint.x,firstPoint.y,p.x,p.y);S.bones.push(b);S.selected=b.id;firstPoint=null;S.mode="select";document.getElementById("mode").textContent="Mode: Select";render();return}
 if(e.shiftKey){S.drag={type:"region",x:p.x,y:p.y};return}
 const b=S.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);
 if(b){S.selected=b.id;S.drag={type:"bone",b,dx:p.x-b.x,dy:p.y-b.y};render()}
});
c.addEventListener("mousemove",e=>{if(!S.drag)return;let p=P(e);if(S.drag.type==="bone"){let b=S.drag.b;b.x=p.x-S.drag.dx;b.y=p.y-S.drag.dy;render()}else{let x=Math.min(S.drag.x,p.x),y=Math.min(S.drag.y,p.y),w=Math.abs(p.x-S.drag.x),h=Math.abs(p.y-S.drag.y);S.region={x,y,w,h};render()}});
window.addEventListener("mouseup",()=>{if(S.drag?.type==="region"){if(S.region?.w>8&&S.region?.h>8)document.getElementById("mode").textContent="Mode: Region ready — click Bind Selected Area";}S.drag=null});
c.addEventListener("contextmenu",e=>{e.preventDefault();let p=P(e),b=S.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);if(b){S.selected=b.id;document.getElementById("deleteBtn").click()}});
render();
