const canvas=document.getElementById('canvas');
const ctx=canvas.getContext('2d');
const state={image:null,imageData:null,bones:[],selected:null,tool:'select',keys:{},time:0,playing:false,strength:.75,falloff:.6};

function uid(){return Math.random().toString(36).slice(2,8)}
function bone(name,x,y,px=null,py=null,parent=null){return {id:uid(),name,x,y,px,py,parent,restX:x,restY:y,restPX:px??x,restPY:py??y}}

function boneStart(b,rest=false){const p=b.parent?state.bones.find(x=>x.id===b.parent):null;return p?(rest?{x:p.restX,y:p.restY}:{x:p.x,y:p.y}):(rest?{x:b.restPX,y:b.restPY}:{x:b.px,y:b.py})}
function segDist(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l=dx*dx+dy*dy;let t=l?((px-ax)*dx+(py-ay)*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))}
function buildMesh(){if(!state.imageData)return;const r=state.imageData,C=30,R=24,v=[];for(let j=0;j<=R;j++)for(let i=0;i<=C;i++){let u=i/C,w=j/R;v.push({u,w,restX:r.x+r.w*u,restY:r.y+r.h*w,weights:[]})}state.mesh={C,R,v};computeWeights()}
function computeWeights(){if(!state.mesh||!state.bones.length)return;for(const q of state.mesh.v){let a=state.bones.map(b=>{let p=boneStart(b,true),d=segDist(q.restX,q.restY,p.x,p.y,b.restX,b.restY);return{id:b.id,w:1/((d+14)*(d+14))}}).sort((a,b)=>b.w-a.w).slice(0,4),sum=a.reduce((x,y)=>x+y.w,0)||1;q.weights=a.map(x=>({id:x.id,w:x.w/sum}))}}
function deformVertex(q){let X=0,Y=0,W=0;for(const z of q.weights){const b=state.bones.find(x=>x.id===z.id);if(!b)continue;const a=boneStart(b,true),c=boneStart(b),rx=b.restX-a.x,ry=b.restY-a.y,nx=b.x-c.x,ny=b.y-c.y,L=Math.hypot(rx,ry)||1,M=Math.hypot(nx,ny)||1,co=(rx*nx+ry*ny)/(L*M),si=(rx*ny-ry*nx)/(L*M),px=q.restX-a.x,py=q.restY-a.y,x=(px*co-py*si)*M/L+c.x,y=(px*si+py*co)*M/L+c.y;X+=x*z.w;Y+=y*z.w;W+=z.w}return W?{x:X/W,y:Y/W}:{x:q.restX,y:q.restY}}
function drawMeshTriangle(a,b,c){const p=deformVertex(a),q=deformVertex(b),r=deformVertex(c),D=state.imageData,x0=D.x+a.u*D.w,y0=D.y+a.w*D.h,x1=D.x+b.u*D.w,y1=D.y+b.w*D.h,x2=D.x+c.u*D.w,y2=D.y+c.w*D.h,den=(x1-x0)*(y2-y0)-(x2-x0)*(y1-y0);if(Math.abs(den)<.001)return;const A=((q.x-p.x)*(y2-y0)-(r.x-p.x)*(y1-y0))/den,B=((r.x-p.x)*(x1-x0)-(q.x-p.x)*(x2-x0))/den,C=((q.y-p.y)*(y2-y0)-(r.y-p.y)*(y1-y0))/den,E=((r.y-p.y)*(x1-x0)-(q.y-p.y)*(x2-x0))/den,F=p.x-A*x0-B*y0,G=p.y-C*x0-E*y0;ctx.save();ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.closePath();ctx.clip();ctx.setTransform(A,C,B,E,F,G);ctx.drawImage(state.image,0,0,state.image.width,state.image.height,0,0,D.w,D.h);ctx.restore()}

function render(){
 ctx.clearRect(0,0,canvas.width,canvas.height);
 if(state.image){drawDeformed();document.getElementById('hint').style.display='none'} else document.getElementById('hint').style.display='block';
 drawBones(); renderList(); renderInspector();
}
function fitImage(img){
 const scale=Math.min(760/img.width,500/img.height,1);
 state.imageData={x:(900-img.width*scale)/2,y:(600-img.height*scale)/2,w:img.width*scale,h:img.height*scale};
}
function drawDeformed(){
 if(!state.mesh){ctx.drawImage(state.image,state.imageData.x,state.imageData.y,state.imageData.w,state.imageData.h);return}
 const m=state.mesh;
 for(let j=0;j<m.R;j++)for(let i=0;i<m.C;i++){let a=m.v[j*(m.C+1)+i],b=m.v[j*(m.C+1)+i+1],c=m.v[(j+1)*(m.C+1)+i],d=m.v[(j+1)*(m.C+1)+i+1];drawMeshTriangle(a,b,d);drawMeshTriangle(a,d,c)}
}
function drawBones(){
 ctx.save();
 state.bones.forEach(b=>{
  const p=b.parent?state.bones.find(x=>x.id===b.parent):null;
  const sx=p?p.x:b.px??b.restPX, sy=p?p.y:b.py??b.restPY;
  ctx.strokeStyle=b.id===state.selected?'#a998ff':'#6c5ce7';ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(b.x,b.y);ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(sx,sy,5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#a998ff';ctx.beginPath();ctx.arc(b.x,b.y,7,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#ddd';ctx.font='12px sans-serif';ctx.fillText(b.name,b.x+9,b.y-8);
 });
 ctx.restore();
}
function renderList(){
 const el=document.getElementById('boneList');el.innerHTML='';
 state.bones.forEach((b,i)=>{const d=document.createElement('div');d.className='boneItem'+(b.id===state.selected?' selected':'');d.textContent='🦴 '+b.name;d.onclick=()=>{state.selected=b.id;render()};el.appendChild(d)})
}
function renderInspector(){
 const el=document.getElementById('inspector'),b=state.bones.find(x=>x.id===state.selected);
 el.innerHTML=b?`<b>${b.name}</b><br>Start: ${Math.round(b.px??b.restPX)}, ${Math.round(b.py??b.restPY)}<br>End: ${Math.round(b.x)}, ${Math.round(b.y)}<br>Parent: ${b.parent?'Connected':'Root'}`:'None';
}
document.getElementById('strength').oninput=e=>state.strength=+e.target.value;
document.getElementById('falloff').oninput=e=>state.falloff=+e.target.value;
document.querySelectorAll('.tool').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.tool').forEach(x=>x.classList.remove('active'));btn.classList.add('active');state.tool=btn.dataset.tool});
document.getElementById('uploadBtn').onclick=()=>{const i=document.getElementById('fileInput');i.accept='image/*';i.click()};
document.getElementById('fileInput').onchange=e=>{
 const f=e.target.files[0];if(!f)return;
 if(f.type.startsWith('image/')){const img=new Image();img.onload=()=>{state.image=img;fitImage(img);buildMesh();render()};img.src=URL.createObjectURL(f)}
 else if(f.name.endsWith('.json')){const rd=new FileReader();rd.onload=()=>loadProject(JSON.parse(rd.result));rd.readAsText(f)}
};
document.getElementById('autoBtn').onclick=()=>{
 if(!state.image){alert('Import an image first.');return}
 const r=state.imageData,cx=r.x+r.w*.5;
 state.bones=[
  bone('Body',cx,r.y+r.h*.48,cx,r.y+r.h*.25),
  bone('Head',cx,r.y+r.h*.18,cx,r.y+r.h*.28,''),
  bone('Upper Arm L',cx-r.w*.10,r.y+r.h*.43,cx-r.w*.02,r.y+r.h*.35),
  bone('Forearm L',cx-r.w*.24,r.y+r.h*.53,cx-r.w*.10,r.y+r.h*.43),
  bone('Upper Arm R',cx+r.w*.10,r.y+r.h*.43,cx+r.w*.02,r.y+r.h*.35),
  bone('Forearm R',cx+r.w*.24,r.y+r.h*.53,cx+r.w*.10,r.y+r.h*.43),
  bone('Upper Leg L',cx-r.w*.07,r.y+r.h*.75,cx-r.w*.03,r.y+r.h*.58),
  bone('Lower Leg L',cx-r.w*.09,r.y+r.h*.95,cx-r.w*.07,r.y+r.h*.75),
  bone('Upper Leg R',cx+r.w*.07,r.y+r.h*.75,cx+r.w*.03,r.y+r.h*.58),
  bone('Lower Leg R',cx+r.w*.09,r.y+r.h*.95,cx+r.w*.07,r.y+r.h*.75)
 ];
 // Correct parent chains
 state.bones[1].parent=state.bones[0].id;
 state.bones[2].parent=state.bones[0].id;state.bones[3].parent=state.bones[2].id;
 state.bones[4].parent=state.bones[0].id;state.bones[5].parent=state.bones[4].id;
 state.bones[6].parent=state.bones[0].id;state.bones[7].parent=state.bones[6].id;
 state.bones[8].parent=state.bones[0].id;state.bones[9].parent=state.bones[8].id;
 state.selected=state.bones[0].id;computeWeights();render()
};
let drag=null;
canvas.addEventListener('mousedown',e=>{
 const p=point(e),b=state.bones.find(x=>Math.hypot(x.x-p.x,x.y-p.y)<14);
 if(state.tool==='bone'){const parent=state.bones[state.bones.length-1];state.bones.push(bone('Bone '+(state.bones.length+1),p.x,p.y,p.x-50,p.y,parent?.id||null));state.selected=state.bones.at(-1).id;render();return}
 if(b){state.selected=b.id;drag={b,dx:p.x-b.x,dy:p.y-b.y};render()}
});
canvas.addEventListener('mousemove',e=>{if(!drag)return;const p=point(e);drag.b.x=p.x-drag.dx;drag.b.y=p.y-drag.dy;render()});
window.addEventListener('mouseup',()=>drag=null);
function point(e){const q=canvas.getBoundingClientRect();return{x:(e.clientX-q.left)*canvas.width/q.width,y:(e.clientY-q.top)*canvas.height/q.height}}
document.getElementById('addKey').onclick=()=>{state.keys[state.time]=state.bones.map(b=>({id:b.id,x:b.x,y:b.y}));render()};
document.getElementById('timelineSlider').oninput=e=>{state.time=+e.target.value;document.getElementById('timeLabel').textContent=state.time.toFixed(1)+'s';applyKey()};
function applyKey(){const k=state.keys[state.time];if(k)k.forEach(v=>{const b=state.bones.find(x=>x.id===v.id);if(b){b.x=v.x;b.y=v.y}});render()}
document.getElementById('reset').onclick=()=>{state.bones.forEach(b=>{b.x=b.restX;b.y=b.restY});render()};
document.getElementById('play').onclick=()=>{state.playing=!state.playing;document.getElementById('play').textContent=state.playing?'⏸ Pause':'▶ Play';if(state.playing)tick()};
function tick(){if(!state.playing)return;state.time+=.033;if(state.time>4)state.time=0;document.getElementById('timelineSlider').value=state.time;document.getElementById('timeLabel').textContent=state.time.toFixed(1)+'s';applyInterpolated();requestAnimationFrame(tick)}
function applyInterpolated(){const ts=Object.keys(state.keys).map(Number).sort((a,b)=>a-b);if(!ts.length){render();return}let a=ts.filter(t=>t<=state.time).pop();let z=ts.find(t=>t>=state.time);if(a===undefined)a=ts[0];if(z===undefined)z=ts.at(-1);const ka=state.keys[a],kb=state.keys[z],u=a===z?0:(state.time-a)/(z-a);ka.forEach(v=>{const b=state.bones.find(x=>x.id===v.id),w=kb.find(x=>x.id===v.id);if(b&&w){b.x=v.x+(w.x-v.x)*u;b.y=v.y+(w.y-v.y)*u}});render()}
function project(){return {version:1,image:state.imageData,bones:state.bones,keys:state.keys}}
document.getElementById('saveBtn').onclick=()=>{const blob=new Blob([JSON.stringify(project(),null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='bonemotion-project.json';a.click()};
function loadProject(p){state.imageData=p.image;state.bones=p.bones||[];state.keys=p.keys||{};state.selected=state.bones[0]?.id||null;render()}
document.getElementById('loadBtn').onclick=()=>{const i=document.getElementById('fileInput');i.accept='.json';i.click()};
render();
