export default async function handler(req, res) {
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(HTML);
    return;
  }
  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    if (body && body.action === 'narrate') {
      try {
        const text = await narrate(body.log || []);
        res.status(200).json({ text });
      } catch (e) {
        res.status(200).json({ text: '(المحكمة تلتزم الصمت...) ' + e.message });
      }
      return;
    }
    res.status(400).json({ error: 'bad action' });
    return;
  }
  res.status(405).json({ error: 'method not allowed' });
}

async function narrate(log) {
  const sys = 'أنت راوٍ درامي عربي للعبة "المحكمة السرية". لا تتخذ أي قرارات ولا تغيّر نقاطاً. صف ما حدث بأسلوب مظلم مشوق في ٢ إلى ٣ جمل قصيرة فقط.';
  const prompt = 'سجل أحداث الجولة:\n' + (log.length ? log.join('\n') : '(لم تقع أحداث)');
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + (process.env.OPENROUTER_KEY || ''),
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bara-chi.vercel.app',
      'X-Title': 'Shadow Tribunal'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 220
    })
  });
  const d = await r.json();
  return (d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '(صمتٌ في أروقة المحكمة...)';
}

const HTML = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<title>المحكمة السرية</title>
<style>
:root{--bg:#0d0b14;--card:#1b1626;--gold:#c9a24b;--red:#b23a48;--green:#3a9d6b;--txt:#e9e4f0;--muted:#8a82a0}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:'Segoe UI',Tahoma,sans-serif}
.wrap{max-width:640px;margin:0 auto;padding:16px;min-height:100vh}
h1{color:var(--gold);text-align:center;letter-spacing:2px;margin:8px 0 4px}
.sub{text-align:center;color:var(--muted);margin-bottom:16px;font-size:13px}
.screen{display:none}.screen.active{display:block}
button{background:var(--card);color:var(--txt);border:1px solid #34294a;border-radius:10px;padding:12px 14px;font-size:15px;cursor:pointer;width:100%;margin:6px 0}
button:hover{border-color:var(--gold)}
.gold{color:var(--gold)}.red{color:var(--red)}.green{color:var(--green)}.muted{color:var(--muted)}
input,select{width:100%;padding:11px;border-radius:10px;border:1px solid #34294a;background:#120f1c;color:var(--txt);margin:6px 0;font-size:15px}
.card{background:var(--card);border:1px solid #34294a;border-radius:12px;padding:12px;margin:8px 0}
.card.bad{border-color:var(--red)}.card.good{border-color:var(--green)}.card.risk{border-color:var(--gold)}
.pill{display:inline-block;font-size:11px;padding:2px 8px;border-radius:20px;background:#2a2238;margin-left:6px}
.big{font-size:22px;text-align:center;margin:14px 0}
.narr{background:#120f1c;border-right:3px solid var(--gold);padding:12px;border-radius:8px;margin:12px 0;line-height:1.7;font-style:italic}
.secret{background:#000;color:#000;padding:14px;border-radius:12px;text-align:center;user-select:none}
.secret.show{background:#1b1626;color:var(--txt)}
.players{display:flex;flex-wrap:wrap;gap:6px}.pc{flex:1 1 30%;background:var(--card);border-radius:10px;padding:8px;text-align:center;font-size:13px;border:1px solid #34294a}
.pc.dead{opacity:.35;text-decoration:line-through}.pc.cur{border-color:var(--gold)}
.timer{text-align:center;color:var(--muted);font-size:13px;margin:8px 0}.small{font-size:12px}
</style>
</head>
<body>
<div class="wrap">
<h1>المحكمة السرية</h1>
<div class="sub">Shadow Tribunal — لعبة تمرير الهاتف</div>
<div id="setup" class="screen active">
<div class="card">
<div class="muted small">عدد اللاعبين (٤ إلى ٦)</div>
<select id="pcount"><option>4</option><option>5</option><option>6</option></select>
<div id="names"></div>
<button class="gold" onclick="startGame()">افتح المحكمة</button>
<button onclick="clearAll()">مسح الجلسة</button>
</div>
<div class="muted small">يُوزّع دور "القاضي السري" على لاعب واحد عشوائياً. لا تكشفه!</div>
</div>
<div id="play" class="screen">
<div class="players" id="playersStrip"></div>
<div class="timer" id="timer"></div>
<div id="stage"></div>
</div>
<div id="over" class="screen"><div class="big" id="overText"></div><button onclick="clearAll()">لعبة جديدة</button></div>
</div>
<script>
var DECK=[
 {id:'defame',name:'تشهير',type:'bad',severity:1,desc:'الهدف يفقد نقطة سمعة'},
 {id:'stab',name:'طعنة',type:'bad',severity:2,desc:'الهدف يفقد نقطة حياة'},
 {id:'shield',name:'درع',type:'good',severity:0,desc:'تتحصّن ضد الهجوم القادم'},
 {id:'bribe',name:'رشوة',type:'risk',severity:1,desc:'+2 سمعة، لكن ٤٠٪ تفقد حياة'},
 {id:'seduce',name:'إغواء',type:'good',severity:0,desc:'+1 سمعة'},
 {id:'scandal',name:'فضيحة',type:'risk',severity:2,desc:'الهدف -2 سمعة، ٣٠٪ ترتد عليك -1 حياة'}
];
var KEY='shadow_tribunal';
var S=null;
function save(){localStorage.setItem(KEY,JSON.stringify(S));}
function $(id){return document.getElementById(id);}
function esc(s){return String(s).replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];});}
function alivePlayers(){return S.players.filter(function(p){return p.life>0;});}
function buildNames(){
 var n=parseInt($('pcount').value,10),h='';
 for(var i=0;i<n;i++){h+='<input id="nm'+i+'" placeholder="اسم اللاعب '+(i+1)+'">';}
 $('names').innerHTML=h;
}
function startGame(){
 var n=parseInt($('pcount').value,10),players=[];
 for(var i=0;i<n;i++){
  var nm=($('nm'+i)&&$('nm'+i).value)?$('nm'+i).value:('اللاعب '+(i+1));
  players.push({id:i,name:nm,life:3,influence:0,role:'member',shield:false,hand:[],hasActed:false});
 }
 players[Math.floor(Math.random()*n)].role='judge';
 S={players:players,round:1,turnIndex:0,phase:'turn',log:[],roundLog:[],trial:null,votes:{},voteIndex:0,winner:null};
 for(var k=0;k<n;k++){deal(k);deal(k);}
 save();show('play');render();
}
function deal(i){
 var c=DECK[Math.floor(Math.random()*DECK.length)];
 S.players[i].hand.push({id:c.id,name:c.name,type:c.type,severity:c.severity,desc:c.desc});
}
function clearAll(){localStorage.removeItem(KEY);S=null;show('setup');buildNames();}
function show(id){['setup','play','over'].forEach(function(s){$(s).classList.remove('active');});$(id).classList.add('active');}
function cur(){return S.players[S.turnIndex];}
function typeLabel(t){return t==='bad'?'مؤذية':(t==='good'?'نافعة':'مخطرة');}
function txt(s){var e=document.createElement('div');e.className='muted';e.style.margin='10px 0';e.innerHTML=s;return e;}
function btn(s,fn){var b=document.createElement('button');b.textContent=s;b.onclick=fn;return b;}
function render(){
 if(S.winner){show('over');$('overText').innerHTML=S.winner;save();return;}
 show('play');renderStrip();
 var st=$('stage');st.innerHTML='';
 if(S.phase==='turn')st.appendChild(turnScreen());
 else if(S.phase==='trial')st.appendChild(trialScreen());
 else if(S.phase==='narrate')st.appendChild(narrateScreen());
}
function renderStrip(){
 var h='';
 S.players.forEach(function(p,i){
  var c='pc'+(p.life<=0?' dead':'')+(i===S.turnIndex&&S.phase==='turn'?' cur':'');
  h+='<div class="'+c+'">'+esc(p.name)+'<br><span>❤ '+p.life+'</span> · <span class="gold">★ '+p.influence+'</span></div>';
 });
 $('playersStrip').innerHTML=h;
}
function turnScreen(){
 var d=document.createElement('div'),p=cur();
 if(p.life<=0){
  d.appendChild(txt('<span class="muted">'+esc(p.name)+' خارج المحكمة. مرّر الجهاز.</span>'));
  d.appendChild(btn('تمرير →',nextTurn));
  return d;
 }
 d.innerHTML='<div class="card secret" id="sec">اضغط لكشف سرّك</div>';
 var sec=d.querySelector('#sec');
 sec.onclick=function(){
  if(sec.classList.contains('show')){sec.classList.remove('show');sec.innerHTML='اضغط لكشف سرّك';}
  else{sec.classList.add('show');
   var r=p.role==='judge'?'<span class="gold">أنت القاضي السري</span>':'أنت عضو عادي';
   sec.innerHTML=r+'<br><span class="small muted">★ سمعتك '+p.influence+' · ❤ حياتك '+p.life+(p.shield?' · 🛡 محصّن':'')+'</span>';}
 };
 if(p.hasActed){
  d.appendChild(txt('لقد تصرفت هذا الدور. مرّر الجهاز للّاعب التالي.'));
  d.appendChild(btn('تمرير →',nextTurn));
  return d;
 }
 d.appendChild(txt('دورك يا <b>'+esc(p.name)+'</b>. العب ورقة أو مرّر.'));
 p.hand.forEach(function(c,ci){
  var card=document.createElement('div');
  var cl=c.type==='bad'?'bad':(c.type==='good'?'good':'risk');
  card.className='card '+cl;
  card.innerHTML='<b>'+esc(c.name)+'</b> <span class="pill">'+typeLabel(c.type)+'</span><br><span class="small">'+esc(c.desc)+'</span>';
  card.onclick=function(){chooseTarget(ci);};
  d.appendChild(card);
 });
 d.appendChild(btn('مرر بلا لعب (دفاع سلبي)',function(){S.roundLog.push(p.name+' التزم الحياد');p.hasActed=true;save();render();}));
 return d;
}
function chooseTarget(ci){
 var p=cur(),targets=S.players.filter(function(x){return x.life>0&&x.id!==p.id;}),d=$('stage');
 d.innerHTML='';
 d.appendChild(txt('اختر هدفاً لـ "'+esc(p.hand[ci].name)+'":'));
 targets.forEach(function(t){d.appendChild(btn(esc(t.name),function(){resolveCard(ci,t.id);}));});
 d.appendChild(btn('إلغاء',render));
}
function resolveCard(ci,tid){
 var p=cur(),c=p.hand[ci],t=S.players[tid],msg=applyCard(c,p,t);
 S.roundLog.push(msg);S.log.push(msg);
 if(c.severity>=2){S.trial={triggered:true};}
 p.hand.splice(ci,1);p.hasActed=true;deal(p.id);
 checkWin();save();render();
}
function applyCard(c,a,t){
 if(c.id==='defame'){t.influence=Math.max(0,t.influence-1);return a.name+' شهّر بـ '+t.name+' (-1 سمعة)';}
 if(c.id==='stab'){if(t.shield){t.shield=false;return t.name+' تدارك الطعنة بدرعه';}t.life--;return a.name+' طعن '+t.name+' (-1 حياة)';}
 if(c.id==='shield'){a.shield=true;return a.name+' تحصّن بدرع';}
 if(c.id==='bribe'){a.influence+=2;if(Math.random()<0.4){a.life--;return a.name+' ارتشى فكسب لكنه انكشف (-1 حياة)';}return a.name+' ارتشى بأمان (+2 سمعة)';}
 if(c.id==='seduce'){a.influence++;return a.name+' استمال الجميع (+1 سمعة)';}
 if(c.id==='scandal'){t.influence=Math.max(0,t.influence-2);if(Math.random()<0.3){a.life--;return 'فضيحة ارتدت على '+a.name+' (-1 حياة)';}return a.name+' فضح '+t.name+' (-2 سمعة)';}
 return a.name+' لعب ورقة';
}
function nextTurn(){
 S.turnIndex++;
 if(S.turnIndex>=S.players.length){endRound();return;}
 save();render();
}
function endRound(){
 S.players.forEach(function(p){p.hasActed=false;});
 S.turnIndex=0;
 if(S.trial&&S.trial.triggered){S.votes={};S.voteIndex=0;S.phase='trial';}
 else{S.phase='narrate';}
 save();render();
}
function trialScreen(){
 var d=document.createElement('div');
 if(S.voteIndex>=S.players.length){resolveTrial();return d;}
 var v=S.players[S.voteIndex];
 if(v.life<=0){S.voteIndex++;return trialScreen();}
 d.innerHTML='<div class="card secret" id="sec">اضغط لكشف سرّك ثم صوّت</div>';
 var sec=d.querySelector('#sec');
 sec.onclick=function(){
  if(sec.classList.contains('show')){sec.classList.remove('show');sec.innerHTML='اضغط لكشف سرّك ثم صوّت';}
  else{sec.classList.add('show');sec.innerHTML='صوّت لمن تريد نفيه من المحكمة:<br><span class="small muted">دورك يا '+esc(v.name)+'</span>';}
 };
 d.appendChild(txt('المحكمة تدعو <b>'+esc(v.name)+'</b> للتصويت السري. مرّر الجهاز.'));
 alivePlayers().forEach(function(t){
  d.appendChild(btn(esc(t.name),function(){S.votes[v.id]=t.id;S.voteIndex++;save();render();}));
 });
 return d;
}
function resolveTrial(){
 var count={};
 Object.keys(S.votes).forEach(function(k){var t=S.votes[k];count[t]=(count[t]||0)+1;});
 var max=-1,top=null,tie=false;
 Object.keys(count).forEach(function(t){if(count[t]>max){max=count[t];top=t;tie=false;}else if(count[t]===max){tie=true;}});
 if(top!==null&&!tie){
  var pl=S.players[top];
  if(pl.shield){pl.shield=false;S.roundLog.push('صوّتت المحكمة لنفي '+pl.name+' لكن درعه حماه');}
  else{pl.life--;S.roundLog.push('نفت المحكمة '+pl.name+' (-1 حياة)');}
 } else {S.roundLog.push('تعادلت الأصوات فلم يُنفَ أحد');}
 S.trial=null;checkWin();S.phase='narrate';save();render();
}
function narrateScreen(){
 var d=document.createElement('div');
 d.appendChild(txt('<b>أحداث الجولة '+(S.round)+':</b>'));
 S.roundLog.forEach(function(e){d.appendChild(txt('• '+esc(e)));});
 var nb=btn('استدعِ راوي المحكمة (AI)',function(){
  nb.disabled=true;nb.textContent='المحكمة تهمس...';
  fetch('',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'narrate',log:S.roundLog})})
   .then(function(r){return r.json();}).then(function(j){
    var n=document.createElement('div');n.className='narr';n.textContent=j.text;d.appendChild(n);
    d.appendChild(btn('إنهاء الجولة ←',function(){S.round++;S.roundLog=[];S.phase='turn';S.turnIndex=0;checkWin();save();render();}));
   }).catch(function(){nb.disabled=false;nb.textContent='استدعِ راوي المحكمة (AI)';});
 });
 d.appendChild(nb);
 return d;
}
function checkWin(){
 if(S.winner)return;
 var judge=S.players.filter(function(p){return p.role==='judge';})[0];
 if(judge.life<=0){S.winner='🏛 فاز الأعضاء! سقط القاضي السري.';return;}
 var al=alivePlayers();
 if(al.length===1){S.winner=(al[0].role==='judge'?'🏛 فاز القاضي السري ':'🏛 سيطر ')+al[0].name+' على المحكمة وحده!';return;}
 if(judge.influence>=7){S.winner='🏛 فاز القاضي السري بسمعته الطاغية!';return;}
}
buildNames();
var saved=localStorage.getItem(KEY);
if(saved){S=JSON.parse(saved);if(S.winner){$('overText').innerHTML=S.winner;show('over');}else render();}
</script>
</body>
</html>`;
