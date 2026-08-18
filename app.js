const c=document.getElementById("c"),ctx=c.getContext("2d");
const S={
 img:null,rect:null,bones:[],selected:null,region:null,drag:null,
 mode:"select",regions:new Map(),showOriginal:true
};

const uid=()=>Math.random().toString(36).slice(2,9);
const makeBone=(name,sx,sy,x,y)=>({
 id:uid(),name,sx,sy,x,y,rx:x,ry:y
});

function point(e){
 const r=c.getBoundingClientRect();
 return {
   x:(e.clientX-r.left)*c.width/r.width,
   y:(e.clientY-r.top)*c.height/r.height
 };
}

function setStatus(text,ok=false){
 const e=document.getElementById("status");
 e.textContent=text;
 e.className="panel"+(ok?" ok":"");
}

function render(){
 ctx.setTransform(1,0,0,1,0,0);
 ctx.clearRect(0,0,c.width,c.height);

 if(S.img){
   document.getElementById("empty").style.display="none";

   if(S.showOriginal){
     ctx.globalAlpha=.22;
     ctx.drawImage(S.img,S.rect.x,S.rect.y,S.rect.w,S.rect.h);
     ctx.globalAlpha=1;
   }

   for(const [id,reg] of S.regions){
     const b=S.bones.find(x=>x.id===id);
     if(b) drawBoundRegion(b,reg);
   }

   if(S.region){
     ctx.save();
     ctx.strokeStyle="#ffd15c";
     ctx.lineWidth=2;
     ctx.setLineDash([7,5]);
     ctx.strokeRect(S.region.x,S.region.y,S.region.w,S.region.h);
     ctx.restore();
   }
 }else{
   document.getElementById("empty").style.display="block";
 }

 drawBones();
 renderLists();
 renderInfo();
 renderSelectionInfo();
}

function drawBoundRegion(b,reg){
 const restDx=b.rx-b.sx,restDy=b.ry-b.sy;
 const dx=b.x-b.sx,dy=b.y-b.sy;

 const restLen=Math.hypot(restDx,restDy)||1;
 const len=Math.hypot(dx,dy)||1;
 const scale=len/restLen;

 const restAngle=Math.atan2(restDy,restDx);
 const angle=Math.atan2(dy,dx);
 const delta=angle-restAngle;

 const cx=reg.x+reg.w/2,cy=reg.y+reg.h/2;

 ctx.save();

 // Deform around the center of the bound region.
 ctx.translate(cx,cy);
 ctx.rotate(delta);
 ctx.scale(scale,scale);
 ctx.translate(-cx,-cy);

 ctx.beginPath();
 ctx.rect(reg.x,reg.y,reg.w,reg.h);
 ctx.clip();

 // Draw only the selected source rectangle from the original image.
 const sx=((reg.x-S.rect.x)/S.rect.w)*S.img.width;
 const sy=((reg.y-S.rect.y)/S.rect.h)*S.img.height;
 const sw=(reg.w/S.rect.w)*S.img.width;
 const sh=(reg.h/S.rect.h)*S.img.height;

 ctx.drawImage(
   S.img,
   sx,sy,sw,sh,
   reg.x,reg.y,reg.w,reg.h
 );

 ctx.restore();

 // Visual outline of what is bound.
 ctx.save();
 ctx.strokeStyle=b.id===S.selected?"rgba(255,208,91,.95)":"rgba(145,125,255,.55)";
 ctx.lineWidth=1.5;
 ctx.strokeRect(reg.x,reg.y,reg.w,reg.h);
 ctx.restore();
}

function drawBones(){
 for(const b of S.bones){
   const selected=b.id===S.selected;
   ctx.strokeStyle=selected?"#ffd15c":"#907cff";
   ctx.lineWidth=selected?5:3;

   ctx.beginPath();
   ctx.moveTo(b.sx,b.sy);
   ctx.lineTo(b.x,b.y);
   ctx.stroke();

   ctx.fillStyle=selected?"#ffd15c":"#9e8aff";
   ctx.beginPath();
   ctx.arc(b.sx,b.sy,5,0,Math.PI*2);
   ctx.fill();

   ctx.beginPath();
   ctx.arc(b.x,b.y,9,0,Math.PI*2);
   ctx.fill();

   ctx.fillStyle="#eceef2";
   ctx.font="12px sans-serif";
   ctx.fillText(b.name,b.x+11,b.y-9);
 }
}

function renderLists(){
 const box=document.getElementById("boneList");
 box.innerHTML="";
 for(const b of S.bones){
   const d=document.createElement("div");
   d.className="bone"+(b.id===S.selected?" selected":"");
   d.innerHTML=`🦴 ${b.name}<br><span style="color:#757d89;font-size:10px">${S.regions.has(b.id)?"Bound":"Not bound"}</span>`;
   d.onclick=()=>{S.selected=b.id;render()};
   d.oncontextmenu=(e)=>{
     e.preventDefault();
     deleteBone(b.id);
   };
   box.appendChild(d);
 }
}

function renderInfo(){
 const b=S.bones.find(x=>x.id===S.selected);
 document.getElementById("info").innerHTML=b?
 `<b>${b.name}</b><br>
 Start: ${Math.round(b.sx)}, ${Math.round(b.sy)}<br>
 End: ${Math.round(b.x)}, ${Math.round(b.y)}<br>
 Binding: ${S.regions.has(b.id)?"✓ region attached":"— none"}`
 :"No bone selected.";
}

function renderSelectionInfo(){
 const e=document.getElementById("selectionInfo");
 if(!S.region){
   e.textContent="No region selected.";
   return;
 }
 e.innerHTML=`X: ${Math.round(S.region.x)}<br>Y: ${Math.round(S.region.y)}<br>
 W: ${Math.round(S.region.w)}<br>H: ${Math.round(S.region.h)}<br><br>
 ${S.selected?(S.regions.has(S.selected)?"This bone already has a bound region.":"Click Bind Region."): "Select a bone first."}`;
}

function deleteBone(id){
 S.bones=S.bones.filter(b=>b.id!==id);
 S.regions.delete(id);
 if(S.selected===id)S.selected=S.bones.at(-1)?.id||null;
 render();
}

document.getElementById("pick").onclick=()=>document.getElementById("file").click();

document.getElementById("file").onchange=e=>{
 const f=e.target.files[0];
 if(!f)return;

 const im=new Image();
 im.onload=()=>{
   S.img=im;
   const k=Math.min(900/im.width,600/im.height,1);
   S.rect={
     x:(1100-im.width*k)/2,
     y:(700-im.height*k)/2,
     w:im.width*k,
     h:im.height*k
   };
   S.bones=[];
   S.selected=null;
   S.region=null;
   S.regions.clear();
   setStatus("Image loaded. Select a region, add a bone, then bind them.",false);
   render();
 };
 im.onerror=()=>setStatus("The browser could not decode this image.",false);
 im.src=URL.createObjectURL(f);
};

document.getElementById("boneBtn").onclick=()=>{
 if(!S.img){
   alert("Import an image first.");
   return;
 }
 S.mode="addBoneStart";
 document.getElementById("mode").textContent="Mode: Add Bone — click start point";
};

document.getElementById("bindBtn").onclick=()=>{
 if(!S.selected){
   alert("Select a bone first.");
   return;
 }
 if(!S.region){
   alert("Hold Shift and drag around the image region first.");
   return;
 }

 S.regions.set(S.selected,{...S.region});
 setStatus("✓ Region is now bound to the selected bone. Drag the round endpoint.",true);
 render();
};

document.getElementById("deleteBtn").onclick=()=>{
 if(S.selected)deleteBone(S.selected);
};

document.getElementById("resetBtn").onclick=()=>{
 for(const b of S.bones){
   b.x=b.rx;
   b.y=b.ry;
 }
 render();
};

document.getElementById("clearRegion").onclick=()=>{
 S.region=null;
 document.getElementById("mode").textContent="Mode: Select";
 render();
};

document.getElementById("ghost").onchange=e=>{
 S.showOriginal=e.target.checked;
 render();
};

c.addEventListener("mousedown",e=>{
 const p=point(e);

 if(e.shiftKey){
   S.drag={type:"region",sx:p.x,sy:p.y};
   S.region={x:p.x,y:p.y,w:0,h:0};
   return;
 }

 if(S.mode==="addBoneStart"){
   S.pending=p;
   S.mode="addBoneEnd";
   document.getElementById("mode").textContent="Mode: Add Bone — click endpoint";
   return;
 }

 if(S.mode==="addBoneEnd"){
   const b=makeBone(
     "Bone "+(S.bones.length+1),
     S.pending.x,S.pending.y,
     p.x,p.y
   );
   S.bones.push(b);
   S.selected=b.id;
   S.mode="select";
   document.getElementById("mode").textContent="Mode: Select";
   render();
   return;
 }

 const b=S.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);
 if(b){
   S.selected=b.id;
   S.drag={type:"bone",b,dx:p.x-b.x,dy:p.y-b.y};
   render();
 }
});

c.addEventListener("mousemove",e=>{
 if(!S.drag)return;
 const p=point(e);

 if(S.drag.type==="bone"){
   S.drag.b.x=p.x-S.drag.dx;
   S.drag.b.y=p.y-S.drag.dy;
   render();
   return;
 }

 const x=Math.min(S.drag.sx,p.x);
 const y=Math.min(S.drag.sy,p.y);
 const w=Math.abs(p.x-S.drag.sx);
 const h=Math.abs(p.y-S.drag.sy);
 S.region={x,y,w,h};
 render();
});

window.addEventListener("mouseup",()=>{
 if(S.drag?.type==="region"){
   if(S.region&&S.region.w>8&&S.region.h>8){
     document.getElementById("mode").textContent="Mode: Region selected — click Bind Region";
   }
 }
 S.drag=null;
});

c.addEventListener("contextmenu",e=>{
 e.preventDefault();
 const p=point(e);
 const b=S.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);
 if(b){
   S.selected=b.id;
   deleteBone(b.id);
 }
});

render();
