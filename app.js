const c=document.getElementById("canvas"),ctx=c.getContext("2d");
const S={img:null,src:null,rect:null,bones:[],mesh:null,selected:null,drag:null,keys:{},time:0,playing:false,addMode:false};

const id=()=>Math.random().toString(36).slice(2,9);
const makeBone=(name,x,y,sx,sy,parent=null)=>({id:id(),name,x,y,sx,sy,parent,rx:x,ry:y,rsx:sx,rsy:sy});

function resizeImage(img){
 const k=Math.min(820/img.width,560/img.height,1);
 S.rect={x:(1000-img.width*k)/2,y:(650-img.height*k)/2,w:img.width*k,h:img.height*k};
 createMesh();
}

function createMesh(){
 const R=24,C=32,r=S.rect,v=[];
 for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){
   const u=i/C,w=j/R;
   v.push({u,w,rx:r.x+r.w*u,ry:r.y+r.h*w,weights:[]});
 }
 S.mesh={R,C,v};
 bindMesh();
}

function start(b,rest=true){
 const p=b.parent&&S.bones.find(x=>x.id===b.parent);
 return p?(rest?{x:p.rx,y:p.ry}:{x:p.x,y:p.y}):(rest?{x:b.rsx,y:b.rsy}:{x:b.sx,y:b.sy});
}

function distanceToSegment(px,py,ax,ay,bx,by){
 const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;
 let t=L?((px-ax)*dx+(py-ay)*dy)/L:0;t=Math.max(0,Math.min(1,t));
 return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}

function bindMesh(){
 if(!S.mesh||!S.bones.length)return;
 for(const v of S.mesh.v){
   const a=S.bones.map(b=>{
     const s=start(b,true);
     const d=distanceToSegment(v.rx,v.ry,s.x,s.y,b.rx,b.ry);
     return {id:b.id,w:1/((d+16)**2)};
   }).sort((a,b)=>b.w-a.w).slice(0,4);
   const sum=a.reduce((n,x)=>n+x.w,0)||1;
   v.weights=a.map(x=>({id:x.id,w:x.w/sum}));
 }
 document.getElementById("binding").className="status ok";
 document.getElementById("binding").textContent="✓ Image bound to bone mesh";
}

function deform(v){
 let x=0,y=0,w=0;
 for(const q of v.weights){
   const b=S.bones.find(z=>z.id===q.id); if(!b)continue;
   const a=start(b,true),d=start(b,false);
   const ax=b.rx-a.x,ay=b.ry-a.y,bx=b.x-d.x,by=b.y-d.y;
   const la=Math.hypot(ax,ay)||1,lb=Math.hypot(bx,by)||1;
   const co=(ax*bx+ay*by)/(la*lb),si=(ax*by-ay*bx)/(la*lb);
   const px=v.rx-a.x,py=v.ry-a.y;
   x+=((px*co-py*si)*lb/la+d.x)*q.w;
   y+=((px*si+py*co)*lb/la+d.y)*q.w;
   w+=q.w;
 }
 return w?{x:x/w,y:y/w}:{x:v.rx,y:v.ry};
}

function triangle(a,b,d){
 const p=deform(a),q=deform(b),r=deform(d),R=S.rect;
 const x0=R.x+a.u*R.w,y0=R.y+a.w*R.h,x1=R.x+b.u*R.w,y1=R.y+b.w*R.h,x2=R.x+d.u*R.w,y2=R.y+d.w*R.h;
 const den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(den)<.001)return;
 const A=((q.x-p.x)*(y2-y0)-(r.x-p.x)*(y1-y0))/den;
 const B=((r.x-p.x)*(x1-x0)-(q.x-p.x)*(x2-x0))/den;
 const C=((q.y-p.y)*(y2-y0)-(r.y-p.y)*(y1-y0))/den;
 const D=((r.y-p.y)*(x1-x0)-(q.y-p.y)*(x2-x0))/den;
 const E=p.x-A*x0-B*y0,F=p.y-C*x0-D*y0;
 ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();
 ctx.setTransform(A,C,B,D,E,F);
 ctx.drawImage(S.img,0,0,S.img.width,S.img.height,0,0,R.w,R.h);
 ctx.restore();
}

function drawImage(){
 const m=S.mesh;
 for(let j=0;j<m.R;j++)for(let i=0;i<m.C;i++){
   const a=m.v[j*(m.C+1)+i],b=m.v[j*(m.C+1)+i+1],d=m.v[(j+1)*(m.C+1)+i+1],e=m.v[(j+1)*(m.C+1)+i];
   triangle(a,b,d);triangle(a,d,e);
 }
}

function drawBones(){
 for(const b of S.bones){
   const s=start(b,false),sel=b.id===S.selected;
   ctx.strokeStyle=sel?"#ffd05b":"#8c77ff";ctx.lineWidth=sel?5:3;
   ctx.beginPath();ctx.moveTo(s.x,s.y);ctx.lineTo(b.x,b.y);ctx.stroke();
   ctx.fillStyle=sel?"#ffd05b":"#9b87ff";ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fill();
   ctx.fillStyle="#eee";ctx.font="12px sans-serif";ctx.fillText(b.name,b.x+9,b.y-8);
 }
}

function render(){
 ctx.clearRect(0,0,c.width,c.height);
 if(S.img&&S.mesh){drawImage();document.getElementById("empty").style.display="none"}else document.getElementById("empty").style.display="block";
 drawBones();renderBones();renderInfo();
}

function renderBones(){
 const box=document.getElementById("bones");box.innerHTML="";
 S.bones.forEach(b=>{const d=document.createElement("div");d.className="bone"+(b.id===S.selected?" sel":"");d.textContent="🦴 "+b.name;d.onclick=()=>{S.selected=b.id;render()};box.appendChild(d)})
}
function renderInfo(){
 const b=S.bones.find(x=>x.id===S.selected);
 document.getElementById("info").innerHTML=b?`<b>${b.name}</b><br>Parent: ${b.parent?"Connected":"Root"}<br>Position: ${Math.round(b.x)}, ${Math.round(b.y)}<br><br>Vertices are automatically weighted to this skeleton.`:"No bone selected.";
}
function pos(e){const r=c.getBoundingClientRect();return{x:(e.clientX-r.left)*c.width/r.width,y:(e.clientY-r.top)*c.height/r.height}}

document.getElementById("import").onclick=()=>document.getElementById("file").click();
document.getElementById("file").onchange=e=>{
 const f=e.target.files[0];if(!f)return;
 const im=new Image();
 im.onload=()=>{S.img=im;resizeImage(im);render()};
 im.src=URL.createObjectURL(f);
};

document.getElementById("autoRig").onclick=()=>{
 if(!S.img)return alert("Import an image first.");
 const r=S.rect,x=r.x+r.w/2;
 S.bones=[
  makeBone("Body",x,r.y+r.h*.48,x,r.y+r.h*.25),
  makeBone("Head",x,r.y+r.h*.18,x,r.y+r.h*.29),
  makeBone("Upper Arm L",x-r.w*.10,r.y+r.h*.43,x-r.w*.02,r.y+r.h*.35),
  makeBone("Forearm L",x-r.w*.24,r.y+r.h*.53,x-r.w*.10,r.y+r.h*.43),
  makeBone("Upper Arm R",x+r.w*.10,r.y+r.h*.43,x+r.w*.02,r.y+r.h*.35),
  makeBone("Forearm R",x+r.w*.24,r.y+r.h*.53,x+r.w*.10,r.y+r.h*.43),
  makeBone("Upper Leg L",x-r.w*.07,r.y+r.h*.75,x-r.w*.03,r.y+r.h*.58),
  makeBone("Lower Leg L",x-r.w*.09,r.y+r.h*.95,x-r.w*.07,r.y+r.h*.75),
  makeBone("Upper Leg R",x+r.w*.07,r.y+r.h*.75,x+r.w*.03,r.y+r.h*.58),
  makeBone("Lower Leg R",x+r.w*.09,r.y+r.h*.95,x+r.w*.07,r.y+r.h*.75)
 ];
 S.bones[1].parent=S.bones[0].id;
 S.bones[2].parent=S.bones[0].id;S.bones[3].parent=S.bones[2].id;
 S.bones[4].parent=S.bones[0].id;S.bones[5].parent=S.bones[4].id;
 S.bones[6].parent=S.bones[0].id;S.bones[7].parent=S.bones[6].id;
 S.bones[8].parent=S.bones[0].id;S.bones[9].parent=S.bones[8].id;
 S.selected=S.bones[0].id;bindMesh();render();
};

document.getElementById("addBone").onclick=()=>{
 if(!S.img){alert("Import an image first.");return}
 S.addMode=true;alert("Click the canvas twice: first for the bone start, second for its end.");
};
let pending=null;
c.addEventListener("click",e=>{
 if(!S.addMode)return;
 const p=pos(e);
 if(!pending){pending=p;return}
 const parent=S.bones.length?S.bones[S.bones.length-1].id:null;
 const b=makeBone("Bone "+(S.bones.length+1),p.x,p.y,pending.x,pending.y,parent);
 S.bones.push(b);S.selected=b.id;pending=null;S.addMode=false;bindMesh();render();
});

c.addEventListener("mousedown",e=>{
 if(S.addMode)return;
 const p=pos(e),b=S.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);
 if(b){S.selected=b.id;S.drag={b,dx:p.x-b.x,dy:p.y-b.y};render()}
});
c.addEventListener("mousemove",e=>{
 if(!S.drag)return;const p=pos(e);S.drag.b.x=p.x-S.drag.dx;S.drag.b.y=p.y-S.drag.dy;render();
});
window.addEventListener("mouseup",()=>S.drag=null);

document.getElementById("reset").onclick=()=>{S.bones.forEach(b=>{b.x=b.rx;b.y=b.ry});render()};
document.getElementById("key").onclick=()=>{S.keys[S.time]=S.bones.map(b=>({id:b.id,x:b.x,y:b.y}));};
document.getElementById("time").oninput=e=>{S.time=+e.target.value;document.getElementById("clock").textContent=S.time.toFixed(2)+"s";render()};
document.getElementById("play").onclick=()=>{S.playing=!S.playing;document.getElementById("play").textContent=S.playing?"⏸ Pause":"▶ Play";if(S.playing)tick()};
function tick(){if(!S.playing)return;S.time+=.016;if(S.time>4)S.time=0;document.getElementById("time").value=S.time;document.getElementById("clock").textContent=S.time.toFixed(2)+"s";render();requestAnimationFrame(tick)}
render();
