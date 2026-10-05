(() => {
  'use strict';

  const A='assets/';
  const scenarios=[
    {name:'Urban Perimeter',tag:'Single Drone',env:'Urban',time:'Day',diff:'Medium',img:'scenario-urban.jpg'},
    {name:'Border Surveillance',tag:'Multiple',env:'Rural',time:'Day',diff:'High',img:'scenario-border.jpg'},
    {name:'Night Infiltration',tag:'Multiple',env:'Night',time:'Low Visibility',diff:'High',img:'scenario-night.jpg'},
    {name:'Swarm Attack',tag:'Swarm',env:'Urban',time:'Day',diff:'Extreme',img:'scenario-swarm.jpg'},
    {name:'Degraded Sensors',tag:'Single',env:'Fog',time:'Low Visibility',diff:'Hard',img:'scenario-fog.jpg'},
    {name:'Mixed Threats',tag:'Multiple',env:'Night',time:'Rain',diff:'Extreme',img:'scenario-rain.jpg'}
  ];
  const seedHistory=[
    {id:'041',mission:'Urban Perimeter',score:82,stats:{score:82,detection:88,classification:83,decision:77,response:74,awareness:86},when:'Today 18:42'},
    {id:'040',mission:'Border Surveillance',score:79,stats:{score:79,detection:84,classification:80,decision:75,response:72,awareness:82},when:'Yesterday 20:11'},
    {id:'039',mission:'Night Infiltration',score:74,stats:{score:74,detection:79,classification:76,decision:71,response:68,awareness:77},when:'02 Oct 2026'}
  ];
  const defaultStats={score:86,detection:92,classification:87,decision:82,response:79,awareness:91};
  const state={page:'home',profile:false,toast:'',history:loadHistory(),session:null,filter:'All',generated:null,replay:null};
  const root=document.getElementById('app');

  function loadHistory(){try{const x=JSON.parse(localStorage.getItem('aeroshield-final-history')||'null');return Array.isArray(x)&&x.length?x:seedHistory}catch{return seedHistory.slice()}}
  function saveHistory(){try{localStorage.setItem('aeroshield-final-history',JSON.stringify(state.history.slice(0,20)))}catch{}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function toast(msg){state.toast=msg;renderToast();clearTimeout(window.__aeroToast);window.__aeroToast=setTimeout(()=>{state.toast='';renderToast()},2200)}
  function renderToast(){document.querySelector('.toast')?.remove();if(!state.toast)return;const d=document.createElement('div');d.className='toast';d.innerHTML='<span>✓</span>'+esc(state.toast);document.body.appendChild(d)}
  function nav(page){state.profile=false;if(page==='training' && (!state.session || !state.session.running)){startSession(state.session?.mission||null);return;}state.page=page;render()}
  function icon(s){return `<span class="navIcon">${s}</span>`}

  function header(){
    const items=[['home','⌂','Home'],['features','✦','Features'],['scenarios','◎','Scenarios'],['training','◉','Training'],['analytics','▥','Analytics'],['readiness','♜','Readiness'],['instructor','⌁','Instructor'],['command','▣','Command Deck'],['judge','✓','Judge Mode'],['about','ⓘ','About']];
    return `<header class="topbar"><button class="brand" data-nav="home"><img src="${A}logo.png"><span><b>AEROSHIELD</b><small>AI THREAT SIMULATION</small></span></button><nav>${items.map(([id,i,l])=>`<button class="${state.page===id?'active':''}" data-nav="${id}">${icon(i)}<span class="navLabel">${l}</span></button>`).join('')}</nav><div class="headerRight"><button class="bell" data-action="alerts">♧<i></i></button><button class="profile" data-action="profile"><span class="avatar">D</span><span><b>Deepak</b><small>Trainee</small></span>⌄</button>${state.profile?`<div class="profileMenu"><b>Deepak</b><span>Trainee</span><hr><button data-action="profile-toast">Profile</button><button data-action="profile-toast">Demo sign-out</button></div>`:''}</div></header>`;
  }

  function stat(n,t){return `<div class="stat"><b>${n}</b><span>${t}</span></div>`}
  function scenarioCard(s){return `<article class="scenarioCard"><div class="scene" style="background-image:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.78)),url(${A+s.img})"><span class="sceneTag">${esc(s.tag)}</span><div class="sceneBottom"><h3>${esc(s.name)}</h3><div><span>${esc(s.env)}</span><span>${esc(s.time)}</span><span class="${s.diff==='Extreme'?'redPill':''}">${esc(s.diff)}</span></div></div></div><button data-start-scenario="${encodeURIComponent(JSON.stringify(s))}">Start →</button></article>`}

  function home(){return `<main class="home"><section class="homeHero" style="background-image:linear-gradient(90deg,rgba(2,9,15,.97) 0%,rgba(2,9,15,.78) 42%,rgba(2,9,15,.18) 100%),url(${A}hero-bg.jpg)"><div class="heroCopy"><div class="eyebrow"><span></span> MINISTRY OF DEFENCE • TRAINING TECHNOLOGY</div><h1>AI-Powered Drone Threat<br><em>Simulation & Adaptive</em><br>Training Platform</h1><div class="tagline">Train. Decide. Adapt. Repeat.</div><p>Realistic threat scenarios. AI evaluation. Adaptive training. Built for repeatable, data-driven readiness against simulated aerial threats.</p><div class="heroButtons"><button class="primary" data-start-training>Start Training →</button><button class="secondary" data-action="demo-toast">▷ Watch Demo</button></div></div><div class="heroStats">${stat('20+','Scenario Types')}${stat('AI','Adaptive Training')}${stat('4','Sensor Feeds')}${stat('AAR','Performance Analysis')}</div></section><section class="homeSection"><div class="sectionTitle"><div><span class="eyebrow cyan">TRAINING ENVIRONMENTS</span><h2>Built for uncertainty.</h2></div><button class="viewAll" data-nav="scenarios">View all scenarios →</button></div><div class="homeCards">${scenarios.slice(0,3).map(scenarioCard).join('')}</div></section></main>`}

  function features(){const f=[['🧠','Adaptive AI','Difficulty and scenario recommendations respond to trainee performance.'],['⌁','Multi-sensor Simulation','Radar, EO/IR, RF and acoustic feeds are represented in one training console.'],['◈','Decision Scoring','Detection, classification, decision quality and response are scored session by session.'],['↻','Procedural Scenarios','Scenario variables are randomized to prevent rote learning.'],['▣','After-Action Review','Replay decisions, timelines and performance metrics after every session.'],['▥','Readiness Analytics','Track progress and identify the next training priority.']];return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">PLATFORM CAPABILITIES</span><h1>Built for uncertainty.</h1><p>Everything needed for repeatable, measurable aerial-threat simulation training.</p></div><button class="primary" data-nav="training">Open Training →</button></div><div class="simpleGrid">${f.map(x=>`<article class="simpleCard"><div style="font-size:22px;color:#10caff">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div></main>`}

  function scenariosPage(){const filters=['All','Single Drone','Multiple','Swarm','Urban','Rural','Night','Adverse Weather'];const shown=scenarios.filter(s=>state.filter==='All'||s.tag===state.filter||s.env===state.filter||s.time===state.filter||(state.filter==='Adverse Weather'&&['Rain','Fog'].includes(s.time)));return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">SCENARIO LIBRARY</span><h1>Training Scenarios</h1><p>Choose a scenario or generate a custom mission.</p></div><button class="primary" data-action="generate">✦ Generate with AI</button></div><div class="filters">${filters.map(x=>`<button class="${state.filter===x?'selected':''}" data-filter="${x}">${x}</button>`).join('')}</div>${state.generated?`<div class="demoBanner"><div><b>AI-generated mission ready</b><span>${esc(state.generated.name)} • ${esc(state.generated.threats)} • ${esc(state.generated.time)} • ${esc(state.generated.weather)}</span></div><button class="primary" data-start-generated>Start Mission →</button></div>`:''}<div class="scenarioGrid">${shown.map(scenarioCard).join('')}</div></main>`}

  function normMission(m){
    const x={...(m||{})};
    x.name=x.name||'Urban Perimeter';x.env=x.env||'Urban';x.time=x.time||'Night';
    x.weather=x.weather||(['Rain','Fog'].includes(x.time)?x.time:(x.env==='Fog'?'Fog':'Clear'));
    x.threats=x.threats||x.tag||'Multiple Drones';x.difficulty=x.difficulty||x.diff||'High';
    return x;
  }
  function createSession(mission){
    return {running:true,elapsed:0,selected:'CONTACT 02',cursorX:50,cursorY:50,decisions:0,mission:normMission(mission),stats:{...defaultStats},events:[['00:00','Mission started'],['00:05','Sensor sweep initialized'],['00:08','Contact 01 detected']],contacts:[
      {n:'CONTACT 01',x:63,y:24,confidence:76,status:'Detected'},
      {n:'CONTACT 02',x:40,y:38,confidence:68,status:'Unidentified'}
    ]};
  }
  function startSession(mission){
    stopEngine();closeReplay();
    state.session=createSession(mission);
    state.page='training';state.profile=false;render();toast(`${state.session.mission.name} started`);
  }

  function training(){
    const s=state.session;if(!s)return '';
    const pressure=Math.min(99,Math.max(18,Math.round(100-s.stats.decision*.42)));
    const selected=s.contacts.find(c=>c.n===s.selected)||s.contacts[0];
    const fmt=`00:${String(Math.floor(s.elapsed/60)).padStart(2,'0')}:${String(s.elapsed%60).padStart(2,'0')}`;
    const contacts=s.contacts.map((c,i)=>({...c,x:c.x+Math.sin(s.elapsed/5+i)*3,y:c.y+Math.cos(s.elapsed/6+i)*3}));
    return `<main class="trainingPage"><aside class="mission"><span class="eyebrow cyan">MISSION INFO</span><h2>MISSION 042</h2><b>${esc(s.mission.name)}</b><div class="missionDate">◷ LIVE TRAINING</div>${infoRow('⌖','Environment',s.mission.env)}${infoRow('◷','Time',s.mission.time)}${infoRow('☁','Weather',s.mission.weather)}${infoRow('⌁','Threat Type',s.mission.threats)}${infoRow('◈','Difficulty',s.mission.difficulty,true)}<div class="miniRadar"><div class="rr one"></div><div class="rr two"></div><i class="rb rba"></i><i class="rb rbb"></i><i class="rb rbc"></i><span class="sweep"></span></div></aside><section class="trainingMain"><div class="trainingTop"><span><i class="liveDot"></i> LIVE SIMULATION</span><span class="missionState">● ENGINE ONLINE</span><strong><span id="tClock">${fmt}</span><small>Mission Time</small></strong><button class="replayBtn" data-replay>REPLAY</button><button class="dangerBtn" data-end-session>END SESSION</button></div><div class="battlefield" id="battlefield" style="background-image:linear-gradient(rgba(3,12,18,.18),rgba(3,12,18,.12)),url(${A}training-bg.jpg)"><div class="telemetry" id="telemetry">${telemetryItem('SCORE',s.stats.score+' / 100')}${telemetryItem('RADAR',s.contacts.length+' Contacts')}${telemetryItem('EO/IR',Math.max(1,s.contacts.length-1)+' Detections')}${telemetryItem('RF ANALYSIS','SIGNAL ACTIVE')}${telemetryItem('ACOUSTIC','1 Detection')}</div><div class="environmentEvent" id="environmentEvent">◌ ${esc(s.mission.weather)} • ${esc(s.environmentEvent||'Baseline sensor conditions')}</div><div class="adaptiveOverlay" id="adaptive"><span>ADAPTIVE PRESSURE</span><b>${pressure}%</b><i><em style="width:${pressure}%"></em></i><small>Decision quality changes simulated training pressure.</small></div><div id="contactLayer" style="display:contents">${contacts.map(c=>`<button class="contactMark ${c.c||'c2'}" data-contact="${esc(c.n)}" style="left:${c.x}%;top:${c.y}%"><b>${esc(c.n)}</b><small>SIMULATED CONTACT • ${Math.round(c.confidence)}%</small></button>`).join('')}</div><div class="sensorCursor" id="sensorCursor" style="left:${s.cursorX||50}%;top:${s.cursorY||50}%"><span></span><b>SENSOR CURSOR</b></div><div class="routeLine"></div><div class="joystickDock"><div class="joystickMeta"><span>🕹 SIM CONTROL</span><small>WASD / ARROWS</small></div><div class="joystick" id="joystick" style="touch-action:none" role="application" aria-label="Simulated sensor cursor joystick"><div class="joystickBase"></div><div class="joystickThumb" id="joystickThumb"></div></div><button class="joystickReset" data-center> CENTER </button></div></div><div class="decision">${['Classify','Track','Monitor','Escalate','Ignore'].map(a=>`<button class="${a==='Escalate'?'warn':''}" data-decision="${a}">${a}</button>`).join('')}</div><div class="trainingBottom" id="trainingBottom"><div class="sensor card"><div class="cardHead">LIVE SENSOR FEED <span>EO/IR</span></div><div class="sensorImage"><div class="scanline"></div><div class="sensorTarget"></div></div><div class="sensorTabs"><b>EO/IR</b><span>Thermal</span><span>Radar</span><span>RF</span><span>Acoustic</span></div><div class="sensorFoot"><span>Condition <b>${esc(s.mission.weather)}</b></span><span>Confidence <b>${Math.round(selected.confidence)}%</b></span></div></div><div class="contact card"><div class="cardHead">CONTACT DETAILS <span class="dangerTag">${esc(selected.status)}</span></div><h3>${esc(selected.n)}</h3><div class="contactGrid"><span>Bearing<b>${214+s.elapsed%70}°</b></span><span>Range<b>${(1.8+(s.elapsed%9)*.13).toFixed(1)} km</b></span><span>Altitude<b>${120+(s.elapsed%5)*8} m</b></span><span>Velocity<b>${42+(s.elapsed%7)} km/h</b></span><span>Confidence<b>${Math.round(selected.confidence)}%</b></span><span>Status<b>${esc(selected.status)}</b></span></div><button class="outline" data-mark-drone>Mark as Drone</button><div class="cardHead" style="margin-top:12px">RECENT EVENTS</div>${s.events.slice(-4).map(e=>`<div class="timeRow"><span>${esc(e[0])}</span><i></i><b>${esc(e[1])}</b></div>`).join('')}</div></div></section></main>`;
  }
  function infoRow(i,a,b,red=false){return `<div class="infoRow"><span>${i} ${esc(a)}<b class="${red?'redText':''}">${esc(b)}</b></span></div>`}
  function telemetryItem(a,b){return `<div><span>${a}<b>${b}</b></span></div>`}

  // ===== Training engine: ONE owner for the clock, joystick, keyboard and gamepad =====
  const engine={timer:null,raf:0,last:0,keys:new Set(),joy:{x:0,y:0},dragging:false,onKey:null,onKeyUp:null,onBlur:null};
  const MOVE_KEYS={w:[0,-1],arrowup:[0,-1],s:[0,1],arrowdown:[0,1],a:[-1,0],arrowleft:[-1,0],d:[1,0],arrowright:[1,0]};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function stopEngine(){
    if(engine.timer){clearInterval(engine.timer);engine.timer=null}
    if(engine.raf){cancelAnimationFrame(engine.raf);engine.raf=0}
    if(engine.onKey){window.removeEventListener('keydown',engine.onKey);window.removeEventListener('keyup',engine.onKeyUp);window.removeEventListener('blur',engine.onBlur)}
    engine.onKey=engine.onKeyUp=engine.onBlur=null;engine.keys.clear();engine.joy={x:0,y:0};engine.dragging=false;engine.last=0;
  }
  function startEngine(){
    if(!engine.timer)engine.timer=setInterval(()=>{try{tick()}catch(err){fail(err)}},1000);
    if(!engine.raf)engine.raf=requestAnimationFrame(frame);
    if(!engine.onKey){
      engine.onKey=e=>{
        const s=state.session;if(state.page!=='training'||!s||!s.running||document.getElementById('replayOverlay'))return;
        const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
        if(e.ctrlKey||e.metaKey||e.altKey)return;
        const k=String(e.key||'').toLowerCase();if(!(k in MOVE_KEYS))return;
        e.preventDefault();engine.keys.add(k);
      };
      engine.onKeyUp=e=>{engine.keys.delete(String(e.key||'').toLowerCase())};
      engine.onBlur=()=>{engine.keys.clear();engine.joy={x:0,y:0};engine.dragging=false};
      window.addEventListener('keydown',engine.onKey);window.addEventListener('keyup',engine.onKeyUp);window.addEventListener('blur',engine.onBlur);
    }
  }
  function keyVector(){let x=0,y=0;engine.keys.forEach(k=>{const v=MOVE_KEYS[k];if(v){x+=v[0];y+=v[1]}});return{x:clamp(x,-1,1),y:clamp(y,-1,1)}}
  function padVector(){try{const pads=navigator.getGamepads?navigator.getGamepads():[];for(const g of pads){if(g&&g.connected&&g.axes&&g.axes.length>=2){const x=Math.abs(g.axes[0])>.15?g.axes[0]:0,y=Math.abs(g.axes[1])>.15?g.axes[1]:0;if(x||y)return{x,y}}}}catch{}return{x:0,y:0}}
  function applyCursor(){const s=state.session,cur=document.getElementById('sensorCursor');if(s&&cur){cur.style.left=s.cursorX+'%';cur.style.top=s.cursorY+'%'}}
  function applyThumb(vx,vy){const th=document.getElementById('joystickThumb');if(th)th.style.transform=`translate(calc(-50% + ${(vx*28).toFixed(1)}px),calc(-50% + ${(vy*28).toFixed(1)}px))`}
  function frame(ts){
    engine.raf=requestAnimationFrame(frame);
    try{
      const s=state.session;if(!s||!s.running||state.page!=='training')return;
      const dt=Math.min(.05,(ts-(engine.last||ts))/1000);engine.last=ts;
      const k=keyVector(),g=padVector();
      const vx=clamp(engine.joy.x+k.x+g.x,-1,1),vy=clamp(engine.joy.y+k.y+g.y,-1,1);
      if(vx||vy){s.cursorX=clamp(s.cursorX+vx*36*dt,4,96);s.cursorY=clamp(s.cursorY+vy*36*dt,6,94);applyCursor()}
      applyThumb(vx,vy);
    }catch(err){fail(err)}
  }
  function tick(){
    const s=state.session;if(!s||!s.running||state.page!=='training')return;
    s.elapsed++;
    if(s.elapsed%12===0){const ev=s.mission.weather==='Fog'?'Visibility degraded':'Cross-sensor correlation stable';s.environmentEvent=ev;s.events.push([timecode(),'AI: '+ev])}
    if(s.elapsed%10===0&&s.contacts.length<5){const n=`CONTACT 0${s.contacts.length+1}`;s.contacts.push({n,x:22+Math.random()*58,y:20+Math.random()*55,confidence:55+Math.random()*30,status:'New Contact',c:'c3'});s.events.push([timecode(),`${n} entered sensor range`])}
    patchTraining();
  }
  function bindTraining(){
    const s=state.session;if(!s)return;
    engine.joy={x:0,y:0};engine.dragging=false;
    const joy=document.getElementById('joystick');
    if(joy){
      const setFromPointer=e=>{const r=joy.getBoundingClientRect(),max=r.width*.34;if(!r.width)return;let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy);if(m>max){dx*=max/m;dy*=max/m}engine.joy.x=dx/max;engine.joy.y=dy/max};
      const end=()=>{engine.dragging=false;engine.joy={x:0,y:0}};
      joy.addEventListener('pointerdown',e=>{engine.dragging=true;try{joy.setPointerCapture(e.pointerId)}catch{}setFromPointer(e);e.preventDefault()});
      joy.addEventListener('pointermove',e=>{if(engine.dragging)setFromPointer(e)});
      ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joy.addEventListener(ev,end));
    }
    if(s.running)startEngine();
  }
  function centerCursor(){const s=state.session;if(!s)return;s.cursorX=50;s.cursorY=50;engine.joy={x:0,y:0};engine.keys.clear();applyCursor();applyThumb(0,0)}

  // ===== In-place patching: never rebuild the battlefield while it is being used =====
  function morph(live,next){
    if(live.nodeType!==next.nodeType||live.nodeName!==next.nodeName){live.replaceWith(next.cloneNode(true));return}
    if(live.nodeType===3){if(live.nodeValue!==next.nodeValue)live.nodeValue=next.nodeValue;return}
    if(live.nodeType!==1)return;
    for(const a of Array.from(live.attributes)){if(!next.hasAttribute(a.name))live.removeAttribute(a.name)}
    for(const a of Array.from(next.attributes)){if(live.getAttribute(a.name)!==a.value)live.setAttribute(a.name,a.value)}
    const lc=live.childNodes,nc=next.childNodes;
    if(lc.length!==nc.length){live.replaceChildren(...Array.from(nc).map(n=>n.cloneNode(true)));return}
    for(let i=0;i<lc.length;i++)morph(lc[i],nc[i]);
  }
  const PATCH_IDS=['tClock','telemetry','environmentEvent','adaptive','contactLayer','trainingBottom'];
  function patchTraining(){
    const s=state.session;if(!s||state.page!=='training')return;
    if(!document.getElementById('battlefield')){render();return}
    const tpl=document.createElement('div');tpl.innerHTML=training();
    for(const id of PATCH_IDS){const a=document.getElementById(id),b=tpl.querySelector('#'+id);if(a&&b)morph(a,b)}
  }
  function timecode(){const t=state.session?.elapsed||0;return `00:${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`}
  function renderTrainingOnly(){patchTraining()}
  function decision(action){
    const s=state.session;if(!s||!s.running)return;
    const impact={Classify:{decision:4,classification:3,score:2},Track:{decision:3,awareness:2,score:2},Monitor:{decision:2,awareness:1,score:1},Escalate:{decision:1,response:2,score:0},Ignore:{decision:-2,awareness:-2,response:-1,score:-2}}[action];
    if(!impact)return;
    const c=s.contacts.find(x=>x.n===s.selected)||s.contacts[0];
    if(c){s.selected=c.n;c.status=action==='Classify'?'Classified':action;c.confidence=Math.min(99,c.confidence+4)}
    for(const k of Object.keys(impact)){s.stats[k]=Math.max(0,Math.min(99,s.stats[k]+impact[k]))}
    s.decisions=(s.decisions||0)+1;
    s.events.push([timecode(),`${s.selected}: ${action} decision recorded`]);
    toast(`${action} decision recorded`);patchTraining();
  }
  function finishSession(){
    const s=state.session;if(!s||!s.running)return;
    stopEngine();closeReplay();
    const stats={...s.stats};
    const nextId=Math.max(0,...state.history.map(h=>Number(h.id)||0))+1;
    state.history.unshift({id:String(nextId).padStart(3,'0'),mission:s.mission.name,score:stats.score,stats,events:s.events.slice(-60),when:new Date().toLocaleString()});
    state.history=state.history.slice(0,20);saveHistory();
    s.running=false;state.page='analytics';render();toast('After-action review generated');
  }

  function replayEvents(){const e=state.session&&state.session.events;if(Array.isArray(e)&&e.length)return e.filter(Array.isArray);const h=state.history[0]&&state.history[0].events;return Array.isArray(h)?h.filter(Array.isArray):[]}
  function closeReplay(){const o=document.getElementById('replayOverlay');if(o){try{o._cleanup&&o._cleanup()}catch{}o.remove()}}
  function openReplay(){
    try{
      closeReplay();
      const events=replayEvents();
      const name=(state.session&&state.session.mission&&state.session.mission.name)||(state.history[0]&&state.history[0].mission)||'Session';
      const onEsc=e=>{if(e.key==='Escape')closeReplay()};
      document.addEventListener('keydown',onEsc);
      if(!events.length){
        document.body.insertAdjacentHTML('beforeend',`<div class="replayOverlay" id="replayOverlay"><div class="replayModal card"><div class="replayModalHead"><div><span class="eyebrow cyan">SESSION REPLAY</span><h2>${esc(name)}</h2><p>No replay events available.</p></div><button class="iconBtn" id="closeReplay" aria-label="Close replay">×</button></div></div></div>`);
        const o=document.getElementById('replayOverlay');o._cleanup=()=>document.removeEventListener('keydown',onEsc);
        document.getElementById('closeReplay').onclick=closeReplay;return;
      }
      document.body.insertAdjacentHTML('beforeend',`<div class="replayOverlay" id="replayOverlay"><div class="replayModal card"><div class="replayModalHead"><div><span class="eyebrow cyan">SESSION REPLAY</span><h2>${esc(name)}</h2><p>Event-driven reconstruction of the simulated training session.</p></div><button class="iconBtn" id="closeReplay" aria-label="Close replay">×</button></div><div class="replayStage" style="background-image:linear-gradient(90deg,rgba(2,12,18,.48),rgba(2,12,18,.15)),url(${A}replay.jpg)"><div class="replayHud"><span>EVENT <b id="replayIndex">1</b>/${events.length}</span><b id="replayTime">${esc(events[0][0])}</b></div><div class="replayMarker" id="replayMarker" style="left:18%;top:26%"><i></i><span>SIM CONTACT</span></div><div class="replayEventCard"><small id="replayTime2">${esc(events[0][0])}</small><strong id="replayText">${esc(events[0][1])}</strong></div></div><div class="replayControls"><button class="primary" id="replayPlay">▶ Play Replay</button><input id="replayRange" type="range" min="0" max="${Math.max(0,events.length-1)}" value="0"><span id="replayPct">100%</span></div><div class="replayEvents" id="replayEvents">${events.map((e,i)=>`<button data-replay-event="${i}"><span>${esc(e[0])}</span><b>${esc(e[1])}</b></button>`).join('')}</div></div></div>`);
      const overlay=document.getElementById('replayOverlay'),range=document.getElementById('replayRange'),play=document.getElementById('replayPlay');
      let timer=null;
      const stop=()=>{if(timer){clearInterval(timer);timer=null}play.textContent='▶ Play Replay'};
      overlay._cleanup=()=>{stop();document.removeEventListener('keydown',onEsc)};
      const update=()=>{
        const i=clamp(Number(range.value)||0,0,events.length-1),e=events[i];
        document.getElementById('replayIndex').textContent=i+1;
        document.getElementById('replayTime').textContent=e[0];document.getElementById('replayTime2').textContent=e[0];document.getElementById('replayText').textContent=e[1];
        document.getElementById('replayPct').textContent=Math.round(((i+1)/events.length)*100)+'%';
        const mk=document.getElementById('replayMarker');mk.style.left=(18+(i*17)%64)+'%';mk.style.top=(26+(i*11)%48)+'%';
        overlay.querySelectorAll('[data-replay-event]').forEach(x=>x.classList.toggle('active',Number(x.dataset.replayEvent)===i));
      };
      range.oninput=()=>{stop();update()};
      overlay.querySelectorAll('[data-replay-event]').forEach(x=>x.onclick=()=>{stop();range.value=x.dataset.replayEvent;update()});
      play.onclick=()=>{
        if(timer){stop();return}
        if(Number(range.value)>=events.length-1){range.value='0';update()}
        play.textContent='Ⅱ Pause';
        timer=setInterval(()=>{const i=Number(range.value);if(i>=events.length-1){stop();return}range.value=String(i+1);update()},850);
      };
      document.getElementById('closeReplay').onclick=closeReplay;
      overlay.addEventListener('click',e=>{if(e.target===overlay)closeReplay()});
      update();
    }catch(err){console.error('[AEROSHIELD] Replay failed',err);closeReplay();toast('Replay unavailable')}
  }


  function analytics(){const s=state.session||{stats:state.history[0]?.stats||defaultStats,mission:{name:state.history[0]?.mission||'Urban Perimeter'},events:state.history[0]?.events||[['00:00','Mission completed']]};const st=s.stats||defaultStats;const timeline=s.events||[];return `<main class="page"><div class="aarTop"><div><span class="eyebrow cyan">AFTER-ACTION REVIEW</span><h1>Training Result</h1><p>Mission 042 | ${esc(s.mission.name)} | Adaptive session</p></div><div><button class="outline" data-replay>Replay Simulation</button><button class="outline" data-action="report">Download Report</button></div></div><div class="aarGrid"><div class="scorePanel card"><div class="cardHead">OVERALL SCORE</div><div class="scoreRing" style="background:conic-gradient(#2df0bd 0 ${st.score}%,#0c2734 ${st.score}% 100%)"><div><b>${st.score}</b><small>/ 100</small></div></div><strong>${st.score>=85?'GOOD PERFORMANCE':st.score>=75?'ON TRACK':'KEEP TRAINING'}</strong></div><div class="performance card"><div class="cardHead">DETAILED PERFORMANCE</div>${[['Detection Time',st.detection],['Classification Accuracy',st.classification],['Decision Making',st.decision],['Response Time',st.response],['Situational Awareness',st.awareness]].map(([l,v])=>`<div class="perfRow"><span>${l}</span><i><b style="width:${v}%"></b></i><strong>${v}%</strong></div>`).join('')}</div><div class="instructor card"><div class="cardHead">AI INSTRUCTOR FEEDBACK</div><div class="feedback"><div>✦</div><p><b>Adaptive coaching.</b><br>Your current focus is <strong>${st.decision<st.classification?'decision quality':'response discipline'}</strong>. The next mission should preserve strong detection while increasing practice in the weaker area.</p></div><button class="primary" data-recommended>Start Recommended Training →</button></div><div class="timeline card"><div class="cardHead">SESSION TIMELINE</div>${timeline.slice(-8).map(e=>`<div class="timeRow"><span>${esc(e[0])}</span><i></i><b>${esc(e[1])}</b></div>`).join('')}</div><div class="replay card"><div class="cardHead">REPLAY</div><div class="replayImg" style="background-image:url(${A}replay.jpg)"><button data-replay>▶</button></div><small>Event-driven session reconstruction</small></div><div class="next card"><div class="cardHead">NEXT RECOMMENDED</div><div class="recommend" style="background-image:linear-gradient(0deg,#000b,transparent),url(${A}recommended.jpg)"><div><span>ADAPTIVE</span><span>HIGH</span></div></div><button class="primary" data-recommended>Start Next Mission →</button></div></div></main>`}

  function readiness(){const latest=state.history[0]?.stats||defaultStats;const avg=Math.round(state.history.reduce((a,h)=>a+h.score,0)/Math.max(1,state.history.length));const readiness=Math.min(99,Math.round(avg*.8+16));return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">TRAINING READINESS</span><h1>Readiness Passport</h1><p>Persistent simulated performance profile.</p></div><button class="primary" data-nav="training">Continue Training →</button></div><section class="readinessHero card"><div class="readinessRing" style="background:conic-gradient(#2de2b0 0 ${readiness}%,#0b2734 ${readiness}% 100%)"><div><b>${readiness}</b><span>/100</span></div></div><div class="readinessIdentity"><span class="eyebrow">TRAINEE PROFILE</span><h2>DEEPAK</h2><div class="statusBadge"><i></i> ${readiness>=90?'MISSION READY':readiness>=80?'ADVANCED READY':'DEVELOPING'}</div><p>Training memory carries recent performance forward so future sessions can target weaker areas.</p><div class="readinessStats"><div><b>${state.history.length}</b><span>SESSIONS</span></div><div><b>${Math.min(100,45+state.history.length*10)}%</b><span>SCENARIO COVERAGE</span></div><div><b>${avg}%</b><span>AVG SCORE</span></div></div></div></section><div class="metricGrid" style="margin-top:10px">${[['Detection',latest.detection],['Classification',latest.classification],['Decision',latest.decision],['Response',latest.response]].map(x=>`<div class="metricCard"><b>${x[1]}%</b><span>${x[0]}</span></div>`).join('')}</div></main>`}

  function instructor(){const s=state.session;return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">INSTRUCTOR COMMAND CENTER</span><h1>Live Training Oversight</h1><p>Observe the synthetic trainee session.</p></div><span class="statusPill"><i></i> ${s?.running?'TRAINEE LINK ACTIVE':'WAITING FOR TRAINEE'}</span></div><div class="simpleGrid"><article class="simpleCard"><span class="eyebrow cyan">LIVE SCORE</span><h3 style="font-size:28px">${s?.stats.score||86}</h3><p>Detection ${s?.stats.detection||92}% • Decision ${s?.stats.decision||82}%</p></article><article class="simpleCard"><span class="eyebrow cyan">SESSION</span><h3>${esc(s?.mission.name||'Waiting for trainee')}</h3><p>${s?.events?.length||0} recorded events • ${s?.running?'LIVE':'IDLE'}</p></article><article class="simpleCard"><span class="eyebrow cyan">INSTRUCTOR TOOLS</span><p>Evaluation-only controls for observations and AAR review.</p><button class="outline" data-nav="analytics">Open AAR →</button></article></div><div class="card" style="margin-top:10px"><div class="cardHead">EVENT STREAM</div>${(s?.events||[['—','Waiting for trainee telemetry']]).slice(-10).reverse().map(e=>`<div class="timeRow"><span>${esc(e[0])}</span><i></i><b>${esc(e[1])}</b></div>`).join('')}</div></main>`}

  function command(){const s=state.session;return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">COMMAND DECK • IMMERSIVE SIMULATION</span><h1>AI Instructor <em>Mission Control</em></h1><p>Simulation command view for coaching, sensor fusion and event pressure.</p></div><span class="statusPill"><i></i> ${s?.running?'LIVE TRAINING':'STANDBY'}</span></div><div class="metricGrid"><div class="metricCard"><b>4</b><span>SENSOR FEEDS</span></div><div class="metricCard"><b>${s?.contacts?.length||2}</b><span>CONTACTS</span></div><div class="metricCard"><b>${s?.stats?.score||86}</b><span>LIVE SCORE</span></div><div class="metricCard"><b>${s?.events?.length||0}</b><span>EVENTS</span></div></div><div class="card" style="margin-top:10px"><div class="cardHead">INSTRUCTOR COACHING</div><p style="font-size:11px;color:#a6bdc8;line-height:1.6">The AI instructor observes simulated decisions, explains training consequences and feeds the after-action review. All contacts and actions are synthetic.</p><button class="primary" data-nav="training">Return to Training →</button></div></main>`}

  function judge(){return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">SIH26247 • 2–3 MINUTE DEMO FLOW</span><h1>Judge <em>Mode</em></h1><p>One guided story from problem to measurable adaptive readiness.</p></div><button class="primary" data-start-training>🚀 Launch Live Demo</button></div><div class="judgeHero card"><div class="judgeHeroCopy"><span class="eyebrow">AEROSHIELD</span><h2>Train. Decide. <em>Adapt. Repeat.</em></h2><p>AI-powered drone-threat simulation and adaptive training. Every decision becomes training data.</p><div class="judgePills"><span>SIMULATION ONLY</span><span>ADAPTIVE ENGINE</span><span>EVENT-DRIVEN AAR</span></div></div><div class="judgeScore"><small>DEMO READINESS</small><b>${Math.max(82,Math.min(99,Math.round(state.history.reduce((a,h)=>a+h.score,0)/state.history.length)))}</b><span>/100 PROFILE</span></div></div><div class="proofPipeline">${[['01','SIMULATE','◉'],['02','DECIDE','⌁'],['03','ADAPT','✦'],['04','COACH','🧠'],['05','REVIEW','▣'],['06','LEARN','♜']].map(x=>`<div><span>${x[0]}</span><b style="font-size:18px;color:#12cfff">${x[2]}</b><b>${x[1]}</b></div>`).join('')}</div><div class="judgeSafety"><b>SAFE DEMO BOUNDARY</b> All contacts, decisions, scoring and instructor actions are synthetic training events. No real-world targeting or weapon-control functionality.</div></main>`}

  function about(){return `<main class="page aboutPage"><span class="eyebrow cyan">AEROSHIELD • SIH26247</span><h1>Train. Decide. <em>Adapt. Repeat.</em></h1><p>AI-powered simulation and adaptive training interface for recognizing, classifying and responding to simulated aerial-threat scenarios.</p><div class="aboutGrid"><article class="card"><h3>Adaptive AI</h3><p>Scenario difficulty and recommendations respond to trainee performance.</p></article><article class="card"><h3>Multi-sensor</h3><p>Radar, EO/IR, RF and acoustic feeds are represented in one training console.</p></article><article class="card"><h3>After-Action Review</h3><p>Replay decisions, timelines and performance metrics after every session.</p></article></div></main>`}

  function fail(err){
    console.error('[AEROSHIELD] Runtime error:',err);
    stopEngine();
    try{
      root.innerHTML=header()+`<main class="page recovery"><span class="eyebrow cyan">RECOVERABLE ERROR</span><h1>This screen failed to load</h1><p>The rest of AEROSHIELD is still running. The full error was logged to the browser console.</p><pre class="errorDetail">${esc((err&&err.stack)||(err&&err.message)||err)}</pre><div class="recoveryActions"><button class="primary" data-recover="training">Restart Training →</button><button class="outline" data-recover="home">Go Home</button></div></main>`;
      try{bindGlobal()}catch{}
      root.querySelectorAll('[data-recover]').forEach(b=>b.onclick=()=>{closeReplay();if(b.dataset.recover==='training'){state.session=null;state.page='training'}else{state.page='home'}render()});
    }catch(e2){root.textContent='AEROSHIELD failed to render: '+((err&&err.message)||err)}
  }
  function render(){
    try{
      if(state.page!=='training')stopEngine();
      if(state.page==='training'&&!state.session)state.session=createSession();
      const views={home,features,scenarios:scenariosPage,training,analytics,readiness,instructor,command,judge,about};
      const content=(views[state.page]||home)();
      root.innerHTML=header()+content;renderToast();bindGlobal();if(state.page==='training')bindTraining();
    }catch(err){fail(err)}
  }
  // One delegated handler for everything inside the live training view (survives in-place patching)
  root.addEventListener('click',e=>{
    const t=e.target&&e.target.closest?e.target.closest('[data-contact],[data-decision],[data-mark-drone],[data-end-session],[data-center]'):null;
    if(!t||!root.contains(t))return;
    try{
      const s=state.session;if(!s||!s.running||state.page!=='training')return;
      if(t.hasAttribute('data-contact')){s.selected=t.dataset.contact;patchTraining()}
      else if(t.hasAttribute('data-decision'))decision(t.dataset.decision);
      else if(t.hasAttribute('data-end-session'))finishSession();
      else if(t.hasAttribute('data-center'))centerCursor();
      else if(t.hasAttribute('data-mark-drone')){const c=s.contacts.find(x=>x.n===s.selected);if(c){c.status='Classified';c.confidence=Math.min(99,c.confidence+6);s.events.push([timecode(),`${c.n} marked for training classification`]);patchTraining();toast('Contact marked for training classification')}}
    }catch(err){fail(err)}
  });
  window.addEventListener('error',ev=>{console.error('[AEROSHIELD] window error:',ev.error||ev.message);if(!root.innerHTML.trim())fail(ev.error||new Error(ev.message))});
  window.addEventListener('unhandledrejection',ev=>console.error('[AEROSHIELD] unhandled rejection:',ev.reason));
  function bindGlobal(){
    document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>nav(b.dataset.nav));
    document.querySelector('[data-action="profile"]')?.addEventListener('click',()=>{state.profile=!state.profile;render()});
    document.querySelectorAll('[data-action="alerts"]').forEach(b=>b.onclick=()=>toast('No new alerts'));
    document.querySelectorAll('[data-action="profile-toast"]').forEach(b=>b.onclick=()=>toast('Demo profile active'));
    document.querySelectorAll('[data-action="demo-toast"]').forEach(b=>b.onclick=()=>toast('Demo preview: use Judge Mode for the guided flow'));
    document.querySelector('[data-start-training]')?.addEventListener('click',()=>startSession());
    document.querySelectorAll('[data-start-scenario]').forEach(b=>b.onclick=()=>startSession(JSON.parse(decodeURIComponent(b.dataset.startScenario))));
    document.querySelector('[data-start-generated]')?.addEventListener('click',()=>startSession(state.generated));
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
    document.querySelector('[data-action="generate"]')?.addEventListener('click',()=>{state.generated={name:'Adaptive Perimeter',env:'Urban',time:'Night',weather:'Degraded',threats:'Multiple Drones',difficulty:'High'};toast('AI training mission generated');render()});
    document.querySelectorAll('[data-replay]').forEach(b=>b.onclick=openReplay);
    document.querySelector('[data-action="report"]')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({platform:'AEROSHIELD',mission:state.session?.mission,stats:state.session?.stats,events:state.session?.events,simulationOnly:true},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='AEROSHIELD-AAR-report.json';a.click();URL.revokeObjectURL(u);toast('AAR report downloaded')});
    document.querySelectorAll('[data-recommended]').forEach(b=>b.onclick=()=>startSession({name:'Adaptive Decision Lab',env:'Urban',time:'Night',weather:'Degraded',threats:'Multiple Drones',difficulty:'High'}));
  }
  render();
})();
