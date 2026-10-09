(() => {
  'use strict';

  const A='assets/';
  const AS=window.AeroShield;
  if(!AS||!AS.SCENARIOS||!AS.createSim)throw new Error('AEROSHIELD scenario engine failed to load (scenarios.js / engine.js)');
  const scenarios=AS.ORDER.map(id=>{const c=AS.SCENARIOS[id];return {id,name:c.name,tag:c.card.tag,env:c.card.env,time:c.card.time,adverse:c.card.adverse,diff:c.difficulty,img:c.card.img}});
  const idByName=n=>{const c=Object.values(AS.SCENARIOS).find(x=>x.name===n);return c?c.id:'urban'};
  const nf=n=>Math.round(n*10)/10;
  const seedHistory=[
    {id:'041',mission:'Urban Perimeter',sid:'urban',score:82,stats:{score:82,detection:88,classification:83,decision:77,response:74,awareness:86},when:'Today 18:42'},
    {id:'040',mission:'Border Surveillance',sid:'border',score:79,stats:{score:79,detection:84,classification:80,decision:75,response:72,awareness:82},when:'Yesterday 20:11'},
    {id:'039',mission:'Night Infiltration',sid:'night',score:74,stats:{score:74,detection:79,classification:76,decision:71,response:68,awareness:77},when:'02 Oct 2026'}
  ];
  const defaultStats={score:86,detection:92,classification:87,decision:82,response:79,awareness:91};
  const state={page:'home',profile:false,toast:'',history:loadHistory(),session:null,filter:'All',generated:null,replay:null};
  const root=document.getElementById('app');

  function loadHistory(){try{const x=JSON.parse(localStorage.getItem('aeroshield-final-history')||'null');return Array.isArray(x)&&x.length?x:seedHistory}catch{return seedHistory.slice()}}
  function saveHistory(){const h=state.history.slice(0,20).map((x,i)=>i<6?x:{...x,frames:undefined});try{localStorage.setItem('aeroshield-final-history',JSON.stringify(h))}catch{try{localStorage.setItem('aeroshield-final-history',JSON.stringify(h.slice(0,6).map(x=>({...x,frames:undefined}))))}catch{}}}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function toast(msg){state.toast=msg;renderToast();clearTimeout(window.__aeroToast);window.__aeroToast=setTimeout(()=>{state.toast='';renderToast()},2200)}
  function renderToast(){document.querySelector('.toast')?.remove();if(!state.toast)return;const d=document.createElement('div');d.className='toast';d.innerHTML='<span>✓</span>'+esc(state.toast);document.body.appendChild(d)}
  function nav(page){state.profile=false;if(page==='training' && (!state.session || !state.session.running)){startSession(state.session?.id||'urban');return;}state.page=page;render()}
  function icon(s){return `<span class="navIcon">${s}</span>`}

  function header(){
    const items=[['home','⌂','Home'],['features','✦','Features'],['scenarios','◎','Scenarios'],['training','◉','Training'],['analytics','▥','Analytics'],['readiness','♜','Readiness'],['instructor','⌁','Instructor'],['command','▣','Command Deck'],['judge','✓','Judge Mode'],['about','ⓘ','About']];
    return `<header class="topbar"><button class="brand" data-nav="home"><img src="${A}logo.png"><span><b>AEROSHIELD</b><small>AI THREAT SIMULATION</small></span></button><nav>${items.map(([id,i,l])=>`<button class="${state.page===id?'active':''}" data-nav="${id}">${icon(i)}<span class="navLabel">${l}</span></button>`).join('')}</nav><div class="headerRight"><button class="bell" data-action="alerts">♧<i></i></button><button class="profile" data-action="profile"><span class="avatar">D</span><span><b>Deepak</b><small>Trainee</small></span>⌄</button>${state.profile?`<div class="profileMenu"><b>Deepak</b><span>Trainee</span><hr><button data-action="profile-toast">Profile</button><button data-action="profile-toast">Demo sign-out</button></div>`:''}</div></header>`;
  }

  function stat(n,t){return `<div class="stat"><b>${n}</b><span>${t}</span></div>`}
  function scenarioCard(s){return `<article class="scenarioCard" data-scenario="${esc(s.id)}"><div class="scene" style="background-image:linear-gradient(180deg,rgba(0,0,0,.02),rgba(0,0,0,.78)),url(${A+s.img})"><span class="sceneTag">${esc(s.tag)}</span><div class="sceneBottom"><h3>${esc(s.name)}</h3><div><span>${esc(s.env)}</span><span>${esc(s.time)}</span><span class="${s.diff==='Extreme'?'redPill':''}">${esc(s.diff)}</span></div></div></div><button data-start-scenario="${esc(s.id)}">Start →</button></article>`}

  function home(){return `<main class="home"><section class="homeHero" style="background-image:linear-gradient(90deg,rgba(2,9,15,.97) 0%,rgba(2,9,15,.78) 42%,rgba(2,9,15,.18) 100%),url(${A}hero-bg.jpg)"><div class="heroCopy"><div class="eyebrow"><span></span> MINISTRY OF DEFENCE • TRAINING TECHNOLOGY</div><h1>AI-Powered Drone Threat<br><em>Simulation & Adaptive</em><br>Training Platform</h1><div class="tagline">Train. Decide. Adapt. Repeat.</div><p>Realistic threat scenarios. AI evaluation. Adaptive training. Built for repeatable, data-driven readiness against simulated aerial threats.</p><div class="heroButtons"><button class="primary" data-start-training>Start Training →</button><button class="secondary" data-action="demo-toast">▷ Watch Demo</button></div></div><div class="heroStats">${stat('20+','Scenario Types')}${stat('AI','Adaptive Training')}${stat('4','Sensor Feeds')}${stat('AAR','Performance Analysis')}</div></section><section class="homeSection"><div class="sectionTitle"><div><span class="eyebrow cyan">TRAINING ENVIRONMENTS</span><h2>Built for uncertainty.</h2></div><button class="viewAll" data-nav="scenarios">View all scenarios →</button></div><div class="homeCards">${scenarios.slice(0,3).map(scenarioCard).join('')}</div></section></main>`}

  function features(){const f=[['🧠','Adaptive AI','Difficulty and scenario recommendations respond to trainee performance.'],['⌁','Multi-sensor Simulation','Radar, EO/IR, RF and acoustic feeds are represented in one training console.'],['◈','Decision Scoring','Detection, classification, decision quality and response are scored session by session.'],['↻','Procedural Scenarios','Scenario variables are randomized to prevent rote learning.'],['▣','After-Action Review','Replay decisions, timelines and performance metrics after every session.'],['▥','Readiness Analytics','Track progress and identify the next training priority.']];return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">PLATFORM CAPABILITIES</span><h1>Built for uncertainty.</h1><p>Everything needed for repeatable, measurable aerial-threat simulation training.</p></div><button class="primary" data-nav="training">Open Training →</button></div><div class="simpleGrid">${f.map(x=>`<article class="simpleCard"><div style="font-size:22px;color:#10caff">${x[0]}</div><h3>${x[1]}</h3><p>${x[2]}</p></article>`).join('')}</div></main>`}

  function scenariosPage(){const filters=['All','Single Drone','Multiple','Swarm','Urban','Rural','Night','Adverse Weather'];const f=state.filter.toLowerCase();const shown=scenarios.filter(s=>state.filter==='All'||(state.filter==='Adverse Weather'?s.adverse:[s.tag,s.env,s.time].some(v=>String(v).toLowerCase().includes(f))));return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">SCENARIO LIBRARY</span><h1>Training Scenarios</h1><p>Choose a scenario or generate a custom mission.</p></div><button class="primary" data-action="generate">✦ Generate with AI</button></div><div class="filters">${filters.map(x=>`<button class="${state.filter===x?'selected':''}" data-filter="${x}">${x}</button>`).join('')}</div>${state.generated?`<div class="demoBanner"><div><b>AI-generated mission ready</b><span>${esc(state.generated.name)} • ${esc(state.generated.threats)} • ${esc(state.generated.time)} • ${esc(state.generated.weather)}</span></div><button class="primary" data-start-generated>Start Mission →</button></div>`:''}<div class="scenarioGrid">${shown.map(scenarioCard).join('')}</div></main>`}

  function normScenarioArg(arg){
    if(typeof arg==='string')return {id:AS.SCENARIOS[arg]?arg:'urban'};
    if(arg&&typeof arg==='object'){
      const id=AS.SCENARIOS[arg.id]?arg.id:(arg.name?idByName(arg.name):'urban');
      return {id,difficulty:AS.DIFFICULTY[arg.difficulty]?arg.difficulty:undefined};
    }
    return {id:'urban'};
  }
  function createSession(arg){
    const a=normScenarioArg(arg);
    const s=AS.createSim(a.id,{difficulty:a.difficulty});
    s.missionNo=String(Math.max(0,...state.history.map(h=>Number(h.id)||0))+1).padStart(3,'0');
    s.feedback=null;
    return s;
  }
  function startSession(arg){
    stopEngine();closeReplay();
    state.session=createSession(arg);
    state.page='training';state.profile=false;render();toast(`${state.session.mission.name} started`);
  }
  // Public entry point required by the scenario library: startTraining("urban"|"border"|"night"|"swarm"|"degraded"|"mixed")
  function startTraining(id,opts){startSession(Object.assign({id},opts||{}))}
  window.startTraining=startTraining;

  const FEED_BG={urban:['#33264a','#c97a55'],border:['#3f86c9','#d4e8f5'],night:['#02060c','#0b1726'],swarm:['#2c4f8a','#d58b5a'],degraded:['#6c7b88','#aab4bb'],mixed:['#1a2342','#6a4560']};
  const TABS=['EO/IR','Thermal','Radar','RF','Acoustic'];
  function sensorClass(S){
    if(!S.available&&S.mod)return 'off';
    if(S.mod||S.dropout||['INTERMITTENT','NOISY','CLUTTER','LOW CONFIDENCE','OVERLOAD RISK','OVERLAPPING','PARTIAL BLOCK','TERRAIN MASK','BLACKOUT','DEGRADED','WEAK','LOW RCS','MULTI-TARGET'].includes(S.status))return 'warn';
    return 'ok';
  }
  function sensorStatusText(S){return !S.available&&S.mod?'OFFLINE':S.status}

  function pickRng(s,k){return AS.rng32((s.elapsed*7919+k*104729)>>>0)}
  function feedSVG(s,tab){
    const W=600,H=115,sel=s.contacts.find(c=>c.n===s.selected);
    const fxy=c=>(s.mode3d&&c.ndcX!=null)?[(c.ndcX*.5+.5)*W,(-c.ndcY*.5+.5)*H*.9+4]:[c.x*6,c.y*1.15];
    const inView=c=>!s.mode3d||(c.ndcX!=null&&Math.abs(c.ndcX)<1.05&&Math.abs(c.ndcY)<1.05);
    const rnd=pickRng(s,tab.length*13+1);
    const live=s.contacts.filter(c=>c.state==='active');
    const noSig=(msg)=>`<rect width="${W}" height="${H}" fill="#02080c"/>${Array.from({length:26},()=>`<rect x="${nf(rnd()*W)}" y="${nf(rnd()*H)}" width="${nf(8+rnd()*30)}" height="1.4" fill="#fff" opacity="${nf(.08+rnd()*.18)}"/>`).join('')}<text x="300" y="60" fill="#ff6572" font-size="11" text-anchor="middle" font-family="monospace">${msg}</text>`;
    const noise=(S)=>Array.from({length:Math.round(S.eff.noise*46)},()=>`<rect x="${nf(rnd()*W)}" y="${nf(rnd()*H)}" width="${nf(2+rnd()*10)}" height="1.2" fill="#fff" opacity="${nf(.1+rnd()*.25)}"/>`).join('');
    let body='';
    if(tab==='EO/IR'||tab==='Thermal'){
      const S=s.sensors.eoir;
      if(!S.available&&S.mod==='outage')return noSig('EO/IR OFFLINE');
      const night=s.cfg.theme==='night'||(s.cfg.theme==='mixed'&&s.envPhase);
      const bg=night&&s.cfg.theme==='mixed'?['#050913','#1a1f33']:FEED_BG[s.cfg.theme];
      if(tab==='Thermal'){
        body=`<defs><radialGradient id="hot"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="#ffe27a"/><stop offset=".7" stop-color="#ff6a2a" stop-opacity=".7"/><stop offset="1" stop-color="#ff2a00" stop-opacity="0"/></radialGradient></defs><rect width="${W}" height="${H}" fill="#050a0d"/>`;
        [[102,92,16],[426,98,20],[528,84,12]].forEach(([x,y,r])=>{body+=`<circle cx="${x}" cy="${y}" r="${r}" fill="url(#hot)" opacity=".22"/>`});
        live.filter(c=>(c.det.eoir||s.elapsed<c.thermalUntil)&&inView(c)).forEach(c=>{const big=s.elapsed<c.thermalUntil,[px,py]=fxy(c);body+=`<circle cx="${nf(px)}" cy="${nf(py)}" r="${big?13:8}" fill="url(#hot)"/>${big?`<text x="${nf(px)}" y="${nf(py-14)}" fill="#ffe27a" font-size="6" text-anchor="middle" font-family="monospace">THERMAL SIG</text>`:''}`});
        body+=noise(S);
      }else{
        body=`<defs><linearGradient id="eob" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#eob)"/><rect y="94" width="${W}" height="21" fill="#04080c" opacity=".75"/>`;
        live.filter(c=>c.det.eoir&&inView(c)).forEach(c=>{const [x0,y0]=fxy(c),x=nf(x0),y=nf(y0);body+=`<g stroke="#8ff5ff" stroke-width="1" fill="none"><rect x="${x-7}" y="${y-7}" width="14" height="14" opacity=".85"/><path d="M${x-3} ${y}h6M${x} ${y-3}v6"/></g><text x="${x+9}" y="${y-8}" fill="#8ff5ff" font-size="5.5" font-family="monospace">C${String(c.id).padStart(2,'0')}</text>`});
        if(sel&&sel.det.eoir&&inView(sel)){const [sx,sy]=fxy(sel);body+=`<rect x="${nf(sx-11)}" y="${nf(sy-11)}" width="22" height="22" fill="none" stroke="#2df0bd" stroke-width="1.2"/>`}
        body+=noise(S);
      }
      body+=`<text x="4" y="9" fill="#9fe" font-size="6" font-family="monospace">${tab==='Thermal'?'THERMAL':'EO/IR'} ${live.filter(c=>c.det.eoir).length} DET · ${sensorStatusText(S)}</text>`;
    }else if(tab==='Radar'){
      const S=s.sensors.radar;
      if(!S.available&&S.mod==='outage')return noSig('RADAR OFFLINE');
      body=`<rect width="${W}" height="${H}" fill="#03120d"/>`;
      [30,60,90].forEach(r=>{body+=`<circle cx="300" cy="108" r="${r}" fill="none" stroke="#1a6a4a" stroke-width=".8"/>`});
      body+=`<g stroke="#144d38"><path d="M300 108V8M300 108L150 40M300 108L450 40"/></g><g class="rsweep" style="transform-origin:300px 108px"><path d="M300 108L300 8" stroke="#3dffa5" stroke-width="1.4"/></g>`;
      live.filter(c=>c.det.radar).forEach(c=>{const r=clamp(AS.rangeKm(s,c)/S.range,0,1)*98,b=AS.bearingDeg(c)*Math.PI/180;const x=300+r*Math.sin(b),y=108-r*Math.cos(b);body+=`<circle cx="${nf(x)}" cy="${nf(y)}" r="2.6" fill="#3dffa5"/><circle cx="${nf(x)}" cy="${nf(y)}" r="5" fill="none" stroke="#3dffa5" opacity=".5"/><text x="${nf(x+6)}" y="${nf(y-4)}" fill="#8affc9" font-size="5" font-family="monospace">C${String(c.id).padStart(2,'0')}</text>`});
      const nClutter=S.mod==='overload'?20:Math.round(S.eff.noise*14);
      for(let i=0;i<nClutter;i++)body+=`<circle cx="${nf(rnd()*W)}" cy="${nf(20+rnd()*88)}" r="${nf(.8+rnd()*1.2)}" fill="#3dffa5" opacity="${nf(.2+rnd()*.35)}"/>`;
      body+=`<text x="4" y="9" fill="#8affc9" font-size="6" font-family="monospace">RADAR ${live.filter(c=>c.det.radar).length} TRK · ${sensorStatusText(S)}</text>`;
    }else if(tab==='RF'){
      const S=s.sensors.rf;
      if(!S.available&&S.mod)return noSig('RF '+(S.mod==='blackout'?'BLACKOUT':'OFFLINE'));
      body=`<rect width="${W}" height="${H}" fill="#0a0814"/>`;
      const bars=72,heights=Array.from({length:bars},()=>4+rnd()*S.eff.noise*30*(S.available?1:.2));
      live.filter(c=>c.det.rf).forEach(c=>{const i=(c.id*5)%bars;const h=c.ev.rf*78;[-1,0,1].forEach(d=>{const j=i+d;if(j>=0&&j<bars)heights[j]=Math.max(heights[j],h*(d?0.55:1))})});
      heights.forEach((h,i)=>{body+=`<rect x="${8+i*8.1}" y="${nf(104-h)}" width="6" height="${nf(h)}" fill="${h>40?'#c58bff':'#5e4a8a'}"/>`});
      body+=`<text x="4" y="9" fill="#d3b0ff" font-size="6" font-family="monospace">RF ${live.filter(c=>c.det.rf).length} SIG · ${sensorStatusText(S)}</text>`;
    }else{
      const S=s.sensors.acoustic;
      body=`<rect width="${W}" height="${H}" fill="#0b0f06"/>`;
      let pts='';const amp=S.available?(S.eff.noise*20):2;
      const sig=live.reduce((a,c)=>a+(c.det.acoustic?c.ev.acoustic:0),0);
      for(let i=0;i<160;i++){const y=57+(rnd()-.5)*amp*2+Math.sin(i/2.2+s.elapsed)*sig*18;pts+=`${nf(i*3.7)},${nf(y)} `}
      body+=`<polyline points="${pts}" fill="none" stroke="#c9ff6a" stroke-width="1"/><line x1="0" y1="57" x2="600" y2="57" stroke="#3b4a1c" stroke-dasharray="3 3"/>`;
      body+=`<text x="4" y="9" fill="#d9ff9a" font-size="6" font-family="monospace">ACOUSTIC ${live.filter(c=>c.det.acoustic).length} DET · ${sensorStatusText(S)}</text>`;
    }
    return `<svg class="feedSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
  }

  function sensorChips(s){
    return AS.SENSORS.map(k=>{const S=s.sensors[k],off=!S.available&&S.mod;return `<div class="sChip ${sensorClass(S)}"><span>${AS.SENSOR_LABEL[k]==='RF ANALYSIS'?'RF':AS.SENSOR_LABEL[k]}</span><b>${off?'—':S.shownConf+'%'}</b><i>${esc(sensorStatusText(S))}</i></div>`}).join('');
  }
  function telemetryLines(s){
    const S=s.sensors,live=s.contacts.filter(c=>c.state==='active');
    const line=(k,noun)=>{const x=S[k];if(!x.available&&x.mod)return 'OFFLINE';return `${x.detections} ${noun}${x.detections===1?'':'s'} • ${x.shownConf}%`};
    return [['SCORE',s.stats.score+' / 100',''],['RADAR',line('radar','Contact'),sensorClass(S.radar)],['EO/IR',line('eoir','Detection'),sensorClass(S.eoir)],['RF ANALYSIS',(!S.rf.available&&S.rf.mod)?'OFFLINE':(S.rf.detections?`${S.rf.detections} Signature${S.rf.detections===1?'':'s'}`:'NO SIGNAL')+' • '+S.rf.shownConf+'%',sensorClass(S.rf)],['ACOUSTIC',line('acoustic','Detection'),sensorClass(S.acoustic)]];
  }
  function alertList(s){
    const out=[];
    AS.SENSORS.forEach(k=>{const S=s.sensors[k];if(S.mod&&(S.mod!=='env'))out.push(`${AS.SENSOR_LABEL[k]==='RF ANALYSIS'?'RF':AS.SENSOR_LABEL[k]} ${S.status}`)});
    const lost=s.contacts.filter(c=>c.state==='occluded').length;if(lost)out.push(`${lost} TRACK${lost>1?'S':''} LOST`);
    if(s.contacts.some(c=>c.conflictUntil>s.elapsed))out.push('SENSOR CONFLICT');
    if(s.thermalFocus)out.push('THERMAL SIGNATURE');
    if(s.cfg.id==='swarm'&&s.radarLoad>=8)out.push('RADAR LOAD '+s.radarLoad);
    return out;
  }
  function markerHTML(c){
    const s=state.session,showPrio=s.cfg.theme==='swarm'||s.cfg.theme==='mixed';
    const lost=c.state==='occluded',conf=Math.round(c.conf);
    const cls=['contactMark',c.classification==='Clutter'?'clsClutter':(conf>=s.cfg.thresholds.classify?'c2':'c1'),lost?'lost':'',c.classification==='Drone'?'clsDrone':'',c.tracked?'tracked':'',c.n===s.selected?'sel':'',c.conflictUntil>s.elapsed?'conflict':'',c.mergeUntil>s.elapsed?'merged':'',(showPrio&&c.rank&&c.rank<=3&&!lost)?'p'+c.rank:''].filter(Boolean).join(' ');
    const rng=AS.rangeKm(s,c).toFixed(1);
    const tag=lost?`TRACK LOST • ${esc(c.occCause||'masked')}`:(c.mergeUntil>s.elapsed?'MERGED TRACK • ':c.conflictUntil>s.elapsed?'⚠ SENSOR CONFLICT • ':'SIM CONTACT • ')+(lost?'':`${conf}% • ${rng} km`);
    const pr=(showPrio&&c.rank&&c.rank<=3&&!lost)?`<em class="prio">P${c.rank}</em>`:'';
    return {cls,html:`<b>${esc(c.n)}${pr}</b><small>${tag}</small>`};
  }
  function objectivesBlock(s){
    const o=AS.objectivesOf(s);
    return `<div class="objTitle">OBJECTIVE</div><p class="objMain">${esc(s.cfg.objectiveText)}</p>${o.map(x=>`<div class="objRow ${x.done?'done':x.failed?'fail':''}"><i>${x.done?'✓':x.failed?'✕':'○'}</i><span>${esc(x.text)}</span><em>${esc(x.show)}</em></div>`).join('')}<div class="objTitle" style="margin-top:8px">SCORING WEIGHTS</div>${Object.entries(s.cfg.scoringWeights).map(([k,w])=>`<div class="wRow"><span>${esc(AS.METRICS[k].label)}</span><b>${Math.round(w*1000)/10}%</b></div>`).join('')}`;
  }
  function missionInfoBlock(s){
    return `${infoRow('⌖','Environment',s.mission.env)}${infoRow('◷','Time',s.mission.time)}${infoRow('☁','Weather',s.mission.weather)}${infoRow('⌁','Threat Type',s.mission.threats)}${infoRow('◈','Difficulty',s.mission.difficulty,['High','Very High','Extreme'].includes(s.mission.difficulty))}`;
  }
  function miniRadarBlock(s){
    return `<div class="rr one"></div><div class="rr two"></div>${s.contacts.filter(c=>c.state==='active').slice(0,15).map(c=>`<i class="rb" style="left:${nf(clamp(c.x,6,94))}%;top:${nf(clamp(c.y*.9+4,6,92))}%"></i>`).join('')}<i class="rb me" style="left:${nf(clamp(s.sensorPos.x,6,94))}%;top:${nf(clamp(s.sensorPos.y*.9+4,6,92))}%"></i><span class="sweep"></span>`;
  }
  function feedbackText(s){
    if(s.feedback&&s.elapsed<s.feedback.until)return `<span class="fb ${s.feedback.tag}">${esc(s.feedback.text)}</span>`;
    if(s.elapsed<10)return `<span class="fb brief"><b>BRIEFING</b> ${esc(s.cfg.briefing)}</span>`;
    if(s.complete)return `<span class="fb brief"><b>MISSION WINDOW COMPLETE</b> End the session to open the after-action review.</span>`;
    return '';
  }

  function training(){
    const s=state.session;if(!s)return '';
    const cfg=s.cfg,P=AS.pressure(s);
    const sel=s.contacts.find(c=>c.n===s.selected&&c.state!=='gone')||s.contacts.find(c=>c.state!=='gone')||null;
    const fmt=timecode();
    const showPrio=cfg.theme==='swarm'||cfg.theme==='mixed';
    const live=s.contacts.filter(c=>c.state!=='gone');
    const alerts=alertList(s);
    const tele=telemetryLines(s);
    const sensorsNow=sel?AS.SENSORS.filter(k=>sel.det[k]).map(k=>AS.SENSOR_LABEL[k]==='RF ANALYSIS'?'RF':AS.SENSOR_LABEL[k]).join(' · ')||'none':'none';
    const lostSel=sel&&sel.state==='occluded';
    const d=s.diff;
    return `<main class="trainingPage" data-scenario="${esc(cfg.id)}"><aside class="mission"><span class="eyebrow cyan">MISSION INFO</span><h2>MISSION ${esc(s.missionNo)}</h2><b>${esc(s.mission.name)}</b><div class="missionDate">◷ LIVE TRAINING</div><div class="missionThumb" style="background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.6)),url(${A+cfg.card.img})"></div><div id="missionInfo">${missionInfoBlock(s)}</div><div class="miniRadar" id="miniRadar">${miniRadarBlock(s)}</div><div class="objBox" id="objBox">${objectivesBlock(s)}</div></aside><section class="trainingMain"><div class="trainingTop"><span><i class="liveDot"></i> LIVE SIMULATION</span><span class="missionState">● ENGINE ONLINE</span><strong><span id="tClock">${fmt}</span><small>Mission Time</small></strong><button class="replayBtn" data-replay>REPLAY</button><button class="dangerBtn" data-end-session>END SESSION</button></div><div class="battlefield theme-${esc(cfg.theme)}${live.length>7?' dense':''}" id="battlefield" data-scenario="${esc(cfg.id)}"><div class="world3d" id="world3d"></div><div class="fx fx-${esc(cfg.theme)} ph${s.envPhase}" id="fxLayer"><span class="fxA"></span><span class="fxB"></span><span class="fxC"></span></div><div class="hudCompass" id="hudCompass"></div><div class="telemetry" id="telemetry">${tele.map(t=>`<div class="${t[2]}"><span>${t[0]}<b>${esc(t[1])}</b></span></div>`).join('')}</div><div class="alertStrip" id="alertStrip">${alerts.map(a=>`<span>⚠ ${esc(a)}</span>`).join('')}</div><div class="environmentEvent" id="environmentEvent">◌ ${esc(s.mission.weather)} • ${esc(s.mission.time)} • ${esc(s.envNote||'Baseline sensor conditions')}</div><div class="adaptiveOverlay" id="adaptive"><span>ADAPTIVE PRESSURE</span><b>${P}%</b><i><em style="width:${P}%"></em></i><small>${esc(s.mission.difficulty)} • ${live.length} contacts • speed ×${d.speedMul.toFixed(2)} • sensors ×${d.sensorRel.toFixed(2)}</small></div><div class="markerLayer" id="markerLayer"></div><div class="crosshair" id="sensorCursor"><span></span><b>SENSOR BORESIGHT</b></div><div class="feedback" id="feedback">${feedbackText(s)}</div><div class="stickDock left"><div class="stickTitle">LEFT STICK<b>THROTTLE · YAW</b></div><div class="stick" id="stickL" data-stick="L" role="application" aria-label="Left stick: throttle and yaw"><i class="ax h"></i><i class="ax v"></i><em class="lbl t">ALT ▲</em><em class="lbl b">ALT ▼</em><em class="lbl l">⟲</em><em class="lbl r">⟳</em><div class="stickThumb" id="thumbL"></div></div><small>W/S altitude • A/D yaw</small></div><div class="stickDock right"><div class="stickTitle">RIGHT STICK<b>MOVE · STRAFE</b></div><div class="stick" id="stickR" data-stick="R" role="application" aria-label="Right stick: forward, back and strafe"><i class="ax h"></i><i class="ax v"></i><em class="lbl t">FWD</em><em class="lbl b">BACK</em><em class="lbl l">◀</em><em class="lbl r">▶</em><div class="stickThumb" id="thumbR"></div></div><small>Arrows move • strafe</small></div><div class="flightHud" id="flightHud"><span>ALT <b id="hudAlt">0</b> m</span><span>SPD <b id="hudSpd">0</b> km/h</span><span>HDG <b id="hudHdg">000</b>°</span><button data-lock title="Lock the contact nearest the crosshair (E)">LOCK [E]</button><button data-view id="hudView" title="Toggle chase / first-person view (V)">VIEW: CHASE [V]</button></div></div><div class="decision">${['Classify','Track','Monitor','Escalate','Ignore'].map(a=>`<button class="${a==='Escalate'?'warn':''}" data-decision="${a}">${a}</button>`).join('')}</div><div class="trainingBottom" id="trainingBottom"><div class="sensor card"><div class="cardHead">LIVE SENSOR FEED <span>${esc(s.tab)}</span></div><div class="sensorImage"><div class="scanline"></div>${feedSVG(s,s.tab)}</div><div class="sensorTabs">${TABS.map(t=>`<button class="${t===s.tab?'on':''}" data-tab="${esc(t)}">${t}</button>`).join('')}</div><div class="sensorChips">${sensorChips(s)}</div><div class="sensorFoot"><span>Condition <b>${esc(s.mission.weather)}</b></span><span>Confidence <b>${sel?Math.round(sel.conf):0}%</b></span></div></div><div class="contact card"><div class="cardHead">CONTACT DETAILS <span class="dangerTag">${esc(sel?sel.status:'None')}</span></div><h3>${esc(sel?sel.n:'NO CONTACT')}</h3><div class="contactGrid"><span>Bearing<b>${sel?AS.bearingDeg(sel,s)+'°':'—'}</b></span><span>Range<b>${sel?AS.rangeKm(s,sel).toFixed(1)+' km':'—'}</b></span><span>Altitude<b>${sel?sel.alt+' m':'—'}</b></span><span>Velocity<b>${sel?Math.round(sel.kmh*s.diff.speedMul)+' km/h':'—'}</b></span><span>Confidence<b>${sel?Math.round(sel.conf)+'%':'—'}</b></span><span>Status<b>${esc(sel?sel.status:'—')}</b></span><span>Sensors<b>${lostSel?'track lost':esc(sensorsNow)}</b></span><span>Assessment<b>${sel?esc(sel.classification||'Unclassified'):'—'}${sel&&showPrio&&sel.rank?' • P'+sel.rank:''}</b></span></div><button class="outline" data-mark-drone>Mark as Drone</button><div class="cardHead" style="margin-top:12px">RECENT EVENTS</div>${s.events.slice(-4).map(e=>`<div class="timeRow"><span>${esc(e[0])}</span><i></i><b>${esc(e[1])}</b></div>`).join('')}</div></div></section></main>`;
  }
  function infoRow(i,a,b,red=false){return `<div class="infoRow"><span>${i} ${esc(a)}<b class="${red?'redText':''}">${esc(b)}</b></span></div>`}

  // ===== Training engine: ONE owner for the sim clock, the 3D world, two-stick flight controls, keyboard and gamepad =====
  const engine={timer:null,raf:0,last:0,keys:new Set(),sticks:{L:{x:0,y:0},R:{x:0,y:0}},drag:{},onKey:null,onKeyUp:null,onBlur:null,hudT:0};
  // Mode-2 layout: LEFT stick = throttle (up/down) + yaw (left/right); RIGHT stick = forward/back + strafe
  const KEY_MAP={w:['L','y',1],s:['L','y',-1],a:['L','x',-1],d:['L','x',1],arrowup:['R','y',1],arrowdown:['R','y',-1],arrowleft:['R','x',-1],arrowright:['R','x',1]};
  const DECISION_KEYS={'1':'Classify','2':'Track','3':'Monitor','4':'Escalate','5':'Ignore'};
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function stopEngine(){
    if(engine.timer){clearInterval(engine.timer);engine.timer=null}
    if(engine.raf){cancelAnimationFrame(engine.raf);engine.raf=0}
    if(engine.onKey){window.removeEventListener('keydown',engine.onKey);window.removeEventListener('keyup',engine.onKeyUp);window.removeEventListener('blur',engine.onBlur)}
    engine.onKey=engine.onKeyUp=engine.onBlur=null;engine.keys.clear();engine.sticks={L:{x:0,y:0},R:{x:0,y:0}};engine.drag={};engine.last=0;
    if(state.world){try{state.world.dispose()}catch{}state.world=null;AS.world=null}
  }
  function startEngine(){
    if(!engine.timer)engine.timer=setInterval(()=>{try{tick()}catch(err){fail(err)}},1000);
    if(!engine.raf)engine.raf=requestAnimationFrame(frame);
    if(!engine.onKey){
      engine.onKey=e=>{
        const s=state.session;if(state.page!=='training'||!s||!s.running||document.getElementById('replayOverlay'))return;
        const t=e.target;if(t&&(t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.tagName==='SELECT'||t.isContentEditable))return;
        if(e.ctrlKey||e.metaKey||e.altKey)return;
        const k=String(e.key||'').toLowerCase();
        if(k in KEY_MAP){e.preventDefault();engine.keys.add(k);return}
        if(e.repeat)return;
        if(k==='e'){e.preventDefault();lockNearest();return}
        if(k==='v'){e.preventDefault();toggleView();return}
        if(DECISION_KEYS[k]){e.preventDefault();decision(DECISION_KEYS[k])}
      };
      engine.onKeyUp=e=>{engine.keys.delete(String(e.key||'').toLowerCase())};
      engine.onBlur=()=>{engine.keys.clear();engine.sticks={L:{x:0,y:0},R:{x:0,y:0}};engine.drag={}};
      window.addEventListener('keydown',engine.onKey);window.addEventListener('keyup',engine.onKeyUp);window.addEventListener('blur',engine.onBlur);
    }
  }
  // composite input = on-screen sticks + keyboard + gamepad (each source clamped independently, then summed)
  function composeInput(){
    const v={L:{x:engine.sticks.L.x,y:engine.sticks.L.y},R:{x:engine.sticks.R.x,y:engine.sticks.R.y}};
    engine.keys.forEach(k=>{const m=KEY_MAP[k];if(m)v[m[0]][m[1]]+=m[2]});
    try{const pads=navigator.getGamepads?navigator.getGamepads():[];for(const g of pads){if(g&&g.connected&&g.axes&&g.axes.length>=4){const dz=x=>Math.abs(x)>.15?x:0;v.L.x+=dz(g.axes[0]);v.L.y-=dz(g.axes[1]);v.R.x+=dz(g.axes[2]);v.R.y-=dz(g.axes[3]);break}}}catch{}
    return {lx:clamp(v.L.x,-1,1),ly:clamp(v.L.y,-1,1),rx:clamp(v.R.x,-1,1),ry:clamp(v.R.y,-1,1)};
  }
  function setThumb(id,x,y){const th=document.getElementById(id);if(th)th.style.transform=`translate(calc(-50% + ${(x*34).toFixed(1)}px),calc(-50% + ${(-y*34).toFixed(1)}px))`}
  const CARD=['N','NE','E','SE','S','SW','W','NW'];
  function updateHud(w){
    const h=w.hud,set=(id,v)=>{const el=document.getElementById(id);if(el&&el.textContent!==String(v))el.textContent=v};
    set('hudAlt',h.alt);set('hudSpd',h.spd);set('hudHdg',String(h.hdg).padStart(3,'0'));
    const tape=document.getElementById('hudCompass');
    if(tape){let html='';const base=Math.round(h.hdg/15)*15;for(let a=base-60;a<=base+60;a+=15){const aa=((a%360)+360)%360,off=(a-h.hdg)*3.4,card=aa%45===0?CARD[aa/45]:'';html+=`<span class="${card?'mj':''}${Math.abs(a-h.hdg)<4?' cur':''}" style="left:calc(50% + ${off.toFixed(1)}px)">${card||'|'}</span>`}tape.innerHTML=html+'<i></i>'}
  }
  function frame(ts){
    engine.raf=requestAnimationFrame(frame);
    try{
      const s=state.session;if(!s||!s.running||state.page!=='training')return;
      const dt=Math.min(.1,(ts-(engine.last||ts))/1000);engine.last=ts;
      const inp=composeInput();
      setThumb('thumbL',inp.lx,inp.ly);setThumb('thumbR',inp.rx,inp.ry);
      const w=state.world;if(w){w.update(dt,inp);engine.hudT+=dt;if(engine.hudT>.07){engine.hudT=0;updateHud(w)}}
    }catch(err){fail(err)}
  }
  function tick(){
    const s=state.session;if(!s||!s.running||state.page!=='training')return;
    AS.tick(s);
    const w=state.world;
    if(w){
      w.sync(s);
      const degr=['eoir','radar'].some(k=>{const m=s.sensors[k].mod;return m==='drop'||m==='overload'});
      w.setShake(degr?.07:0);
    }
    patchTraining();
  }
  function lockNearest(){const s=state.session,w=state.world;if(!s||!w)return;const c=w.lockNearest();if(c){s.selected=c.n;s.feedback={text:`${c.n} locked`,tag:'ok',until:s.elapsed+3};patchTraining()}else toast('No contact near the crosshair')}
  function toggleView(){const w=state.world;if(!w)return;w.setView(w.view==='chase'?'fpv':'chase');const b=document.getElementById('hudView');if(b)b.textContent=`VIEW: ${w.view==='chase'?'CHASE':'FPV'} [V]`}
  // WebGL missing: keep the mission playable on a flat fallback scene so training never shows a blank screen
  function fallbackWorld(el,s){
    el.innerHTML=AS.sceneSVG(s.cfg.scene,s.cfg.fieldKm).replace('class="sceneSvg"','class="sceneSvg fallback"');
    const layer=document.getElementById('markerLayer'),markers=new Map();
    const w={fallback:true,view:'chase',hud:{alt:0,spd:0,hdg:0},player:{},
      sync(sim){const live=sim.contacts.filter(c=>c.state!=='gone'),names=new Set(live.map(c=>c.n));live.forEach(c=>{let m=markers.get(c.n);const h=markerHTML(c);if(!m){m=document.createElement('button');m.dataset.contact=c.n;layer.appendChild(m);markers.set(c.n,m)}m.className=h.cls;m.innerHTML=h.html;const p=c.state==='occluded'&&c.lastKnown?c.lastKnown:c;m.style.left=clamp(p.x,2,97)+'%';m.style.top=clamp(p.y,4,92)+'%';m.style.transform='translate(-50%,-50%)'});markers.forEach((m,n)=>{if(!names.has(n)){m.remove();markers.delete(n)}})},
      refreshMarkers(sim){this.sync(sim)},update(){},lockNearest(){return null},setView(){},setShake(){},setThermal(){},dispose(){markers.forEach(m=>m.remove());markers.clear()}};
    w.sync(s);return w;
  }
  function bindTraining(){
    const s=state.session;if(!s)return;
    engine.sticks={L:{x:0,y:0},R:{x:0,y:0}};engine.drag={};
    document.querySelectorAll('.stick[data-stick]').forEach(el=>{
      const name=el.dataset.stick;
      const setFromPointer=e=>{const r=el.getBoundingClientRect(),max=r.width*.36;if(!r.width)return;let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);const m=Math.hypot(dx,dy);if(m>max){dx*=max/m;dy*=max/m}engine.sticks[name]={x:dx/max,y:-dy/max}};
      const end=()=>{engine.drag[name]=false;engine.sticks[name]={x:0,y:0}};
      el.addEventListener('pointerdown',e=>{engine.drag[name]=true;try{el.setPointerCapture(e.pointerId)}catch{}setFromPointer(e);e.preventDefault()});
      el.addEventListener('pointermove',e=>{if(engine.drag[name])setFromPointer(e)});
      ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>el.addEventListener(ev,end));
    });
    // 3D world (recreated from the persisted player state if the page is re-rendered)
    const host=document.getElementById('world3d'),layer=document.getElementById('markerLayer');
    if(state.world){try{state.world.dispose()}catch{}state.world=null}
    if(host){
      let w=null;
      if(AS.World&&AS.World.supported){try{w=AS.World.create(host,s,{markerLayer:layer,markerHTML})}catch(err){console.error('[AEROSHIELD] 3D world failed',err);w=null}}
      if(!w){w=fallbackWorld(host,s);s.mode3d=false;toast('3D unavailable (WebGL) - using flat fallback scene')}else s.mode3d=true;
      state.world=w;AS.world=w;
      if(w.setThermal)w.setThermal(s.tab==='Thermal'||s.cfg.theme==='night'&&false);
      const vb=document.getElementById('hudView');if(vb&&w.view)vb.textContent=`VIEW: ${w.view==='chase'?'CHASE':'FPV'} [V]`;
      const bf=document.getElementById('battlefield');if(bf)bf.classList.toggle('thermal',s.tab==='Thermal');
    }
    if(s.running)startEngine();
  }

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
  const PATCH_IDS=['tClock','missionInfo','miniRadar','objBox','fxLayer','telemetry','alertStrip','environmentEvent','adaptive','feedback','trainingBottom'];
  function patchTraining(){
    const s=state.session;if(!s||state.page!=='training')return;
    if(!document.getElementById('battlefield')){render();return}
    const tpl=document.createElement('div');tpl.innerHTML=training();
    for(const id of PATCH_IDS){const a=document.getElementById(id),b=tpl.querySelector('#'+id);if(a&&b)morph(a,b)}
    const bf=document.getElementById('battlefield');if(bf){bf.classList.toggle('dense',s.contacts.filter(c=>c.state!=='gone').length>7);bf.classList.toggle('thermal',s.tab==='Thermal')}
    if(state.world)state.world.refreshMarkers(s);
  }
  function timecode(){const t=state.session?.elapsed||0;return `00:${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`}
  function renderTrainingOnly(){patchTraining()}
  function decision(action){
    const s=state.session;if(!s||!s.running)return;
    const r=AS.decide(s,action,s.selected);
    if(!r)return;
    if(r.duplicate){s.feedback={text:r.text,tag:'ok',until:s.elapsed+4};toast(r.text);patchTraining();return}
    const label={duplicate:'Already recorded',correct:'Correct',premature:'Premature - evidence below threshold','false-positive':'False positive - clutter classified as drone','false-escalation':'False escalation on clutter','missed-threat':'Real contact dismissed',blind:'No live track on this contact',ok:'Logged'}[r.tag]||'Logged';
    s.feedback={text:`${r.contact.n} • ${action}: ${label}`,tag:r.tag,until:s.elapsed+6};
    toast(`${action} decision recorded`);patchTraining();
  }
  function finishSession(){
    const s=state.session;if(!s||!s.running)return;
    stopEngine();closeReplay();
    AS.finalize(s);
    const sum=AS.summary(s);
    const stats={...s.stats};
    const nextId=Math.max(0,...state.history.map(h=>Number(h.id)||0))+1;
    state.history.unshift({id:String(nextId).padStart(3,'0'),mission:s.mission.name,sid:s.id,score:stats.score,stats,summary:sum,events:s.events.slice(-120),frames:s.frames.slice(-140),when:new Date().toLocaleString()});
    state.history=state.history.slice(0,20);saveHistory();
    s.running=false;state.page='analytics';render();toast('After-action review generated');
  }

  // ===== AAR / replay data source (live session if present, otherwise the latest saved session) =====
  function legacySummary(h){
    const id=h.sid||idByName(h.mission),cfg=AS.SCENARIOS[id]||AS.SCENARIOS.urban,st=h.stats||defaultStats;
    const metrics={};Object.keys(AS.METRICS).forEach(k=>{metrics[k]=Math.round(st[k]!=null?st[k]:(st[AS.METRICS[k].legacy]!=null?st[AS.METRICS[k].legacy]:st.decision||60))});
    return {id,name:cfg.name,environment:cfg.environment,envShort:cfg.card.env,time:cfg.time,weather:cfg.weather,difficulty:cfg.difficulty,threats:'—',contacts:'—',clutter:0,sensors:4,score:h.score,metrics,weights:cfg.scoringWeights,aarMetrics:cfg.aarMetrics,counters:{},objectives:[],duration:0,decisions:0,objectiveText:cfg.objectiveText,eventsTriggered:0,legacy:true};
  }
  function aarData(){
    const s=state.session;
    if(s&&s.cfg){const sum=AS.summary(s);return {sum,events:(s.events||[]).filter(Array.isArray),frames:s.frames||[],live:s.running,no:s.missionNo,id:s.id}}
    const h=state.history[0];
    if(h){const sum=h.summary||legacySummary(h);return {sum,events:(h.events||[]).filter(Array.isArray),frames:h.frames||[],live:false,no:h.id,id:sum.id}}
    const sum=legacySummary({mission:'Urban Perimeter',score:defaultStats.score,stats:defaultStats});
    return {sum,events:[['00:00','Mission completed','system']],frames:[],live:false,no:'042',id:sum.id};
  }
  function replayEvents(){return aarData().events}
  function closeReplay(){const o=document.getElementById('replayOverlay');if(o){try{o._cleanup&&o._cleanup()}catch{}o.remove()}}
  function evSeconds(tcode){const p=String(tcode||'').split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:0}
  function replayStage(d,i){
    const sum=d.sum,cfg=AS.SCENARIOS[sum.id]||AS.SCENARIOS.urban,e=d.events[i];
    const f=d.frames.length?AS.frameAt(null,evSeconds(e[0]),d.frames):null;
    const sensors=f?f.s:[];
    const marks=f?f.c.map(c=>{const lost=c[4],drone=c[3],cls=c[6];return `<div class="rpMark ${lost?'lost':''} ${drone?'drone':'clutter'} ${c[7]?'fp':''}" style="left:${nf(clamp(c[1],2,97))}%;top:${nf(clamp(c[2],4,92))}%"><i></i><span>C${String(c[0]).padStart(2,'0')} ${lost?'LOST':drone?(cls===1?'DRONE':'DRONE?'):'CLUTTER'}</span></div>`}).join(''):'';
    const chips=sensors.length?AS.SENSORS.map((k,j)=>`<span class="${sensors[j][0]===0?'off':''}">${k==='eoir'?'EO/IR':k.toUpperCase()} <b>${sensors[j][0]?sensors[j][0]+'%':'OFF'}</b> ${esc(sensors[j][1])}</span>`).join(''):'';
    return {marks,chips,env:f&&f.env};
  }
  function openReplay(){
    try{
      closeReplay();
      const d=aarData(),events=d.events,sum=d.sum,cfg=AS.SCENARIOS[sum.id]||AS.SCENARIOS.urban;
      const name=sum.name;
      const onEsc=e=>{if(e.key==='Escape')closeReplay()};
      document.addEventListener('keydown',onEsc);
      if(!events.length){
        document.body.insertAdjacentHTML('beforeend',`<div class="replayOverlay" id="replayOverlay"><div class="replayModal card"><div class="replayModalHead"><div><span class="eyebrow cyan">SESSION REPLAY</span><h2>${esc(name)}</h2><p>No replay events available.</p></div><button class="iconBtn" id="closeReplay" aria-label="Close replay">×</button></div></div></div>`);
        const o=document.getElementById('replayOverlay');o._cleanup=()=>document.removeEventListener('keydown',onEsc);
        document.getElementById('closeReplay').onclick=closeReplay;return;
      }
      const st0=replayStage(d,0);
      document.body.insertAdjacentHTML('beforeend',`<div class="replayOverlay" id="replayOverlay" data-scenario="${esc(sum.id)}"><div class="replayModal card"><div class="replayModalHead"><div><span class="eyebrow cyan">SESSION REPLAY • ${esc(name.toUpperCase())}</span><h2>${esc(name)}</h2><p>${esc(sum.environment)} • ${esc(sum.time)} • ${esc(sum.difficulty)} • ${sum.threats} threat contact(s) reconstructed from the recorded session.</p></div><button class="iconBtn" id="closeReplay" aria-label="Close replay">×</button></div><div class="replayStage theme-${esc(cfg.theme)}" id="replayStage"><div class="sceneLayer">${AS.sceneSVG(cfg.scene,cfg.fieldKm)}</div><div class="fx fx-${esc(cfg.theme)}" id="replayFx"><span class="fxA"></span><span class="fxB"></span><span class="fxC"></span></div><div class="replayHud"><span>EVENT <b id="replayIndex">1</b>/${events.length}</span><b id="replayTime">${esc(events[0][0])}</b></div><div id="replayContacts">${st0.marks}</div><div class="replaySensors" id="replaySensors">${st0.chips}</div><div class="replayEventCard"><small id="replayTime2">${esc(events[0][0])}</small><strong id="replayText">${esc(events[0][1])}</strong></div></div><div class="replayControls"><button class="primary" id="replayPlay">▶ Play Replay</button><input id="replayRange" type="range" min="0" max="${Math.max(0,events.length-1)}" value="0"><span id="replayPct">100%</span></div><div class="replayEvents" id="replayEvents">${events.map((e,i)=>`<button data-replay-event="${i}"><span>${esc(e[0])}</span><b>${esc(e[1])}</b></button>`).join('')}</div></div></div>`);
      const overlay=document.getElementById('replayOverlay'),range=document.getElementById('replayRange'),play=document.getElementById('replayPlay');
      let timer=null;
      const stop=()=>{if(timer){clearInterval(timer);timer=null}play.textContent='▶ Play Replay'};
      overlay._cleanup=()=>{stop();document.removeEventListener('keydown',onEsc)};
      const update=()=>{
        const i=clamp(Number(range.value)||0,0,events.length-1),e=events[i],st=replayStage(d,i);
        document.getElementById('replayIndex').textContent=i+1;
        document.getElementById('replayTime').textContent=e[0];document.getElementById('replayTime2').textContent=e[0];document.getElementById('replayText').textContent=e[1];
        document.getElementById('replayPct').textContent=Math.round(((i+1)/events.length)*100)+'%';
        document.getElementById('replayContacts').innerHTML=st.marks;document.getElementById('replaySensors').innerHTML=st.chips;
        document.getElementById('replayFx').className='fx fx-'+cfg.theme+(st.env?' ph1':'');
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

  function analytics(){
    const d=aarData(),sum=d.sum,cfg=AS.SCENARIOS[sum.id]||AS.SCENARIOS.urban,m=sum.metrics,score=sum.score;
    const rows=sum.aarMetrics.map(k=>({k,label:AS.METRICS[k].label,v:m[k],w:sum.weights[k]}));
    const weakest=rows.slice().sort((a,b)=>a.v-b.v)[0];
    const reco=AS.recommend(sum),rc=AS.SCENARIOS[reco.id];
    const c=sum.counters||{};
    const fb=sum.legacy?`This is a saved session from before scenario-specific scoring. Start a ${esc(cfg.name)} mission to see the scenario metrics.`:`Your lowest area was <strong>${esc(weakest.label)}</strong> (${weakest.v}%). ${esc(cfg.coach)} ${c.falseEsc?`You made ${c.falseEsc} false escalation(s). `:''}${c.premature?`${c.premature} decision(s) were premature. `:''}${c.missed?`${c.missed} detection(s) went unattended.`:''}`;
    const objs=sum.objectives||[];
    const evs=(d.events||[]).filter(e=>e[2]==='event'||e[2]==='sensor').slice(-6);
    return `<main class="page" data-scenario="${esc(sum.id)}"><div class="aarTop"><div><span class="eyebrow cyan">AFTER-ACTION REVIEW${d.live?' • LIVE (SESSION IN PROGRESS)':''}</span><h1>Training Result</h1><p>Mission ${esc(d.no)} | ${esc(sum.name)} | ${esc(sum.environment)} / ${esc(sum.time)} | ${esc(sum.difficulty)}</p></div><div><button class="outline" data-replay>Replay Simulation</button><button class="outline" data-action="report">Download Report</button></div></div><div class="aarGrid"><div class="scorePanel card"><div class="cardHead">OVERALL SCORE</div><div class="scoreRing" style="background:conic-gradient(#2df0bd 0 ${score}%,#0c2734 ${score}% 100%)"><div><b>${score}</b><small>/ 100</small></div></div><strong>${score>=85?'GOOD PERFORMANCE':score>=75?'ON TRACK':'KEEP TRAINING'}</strong><small class="aarNote">${esc(sum.name)} scoring weights</small></div><div class="performance card"><div class="cardHead">DETAILED PERFORMANCE</div><div class="aarFacts"><span>Scenario<b>${esc(sum.name)}</b></span><span>Environment<b>${esc(sum.envShort||sum.environment)} / ${esc(sum.time)}</b></span><span>Threats<b>${esc(sum.threats)}</b></span><span>Sensors<b>${sum.sensors}</b></span></div>${rows.map(r=>`<div class="perfRow"><span>${esc(r.label)}${r.w?` <em>${Math.round(r.w*1000)/10}%</em>`:''}</span><i><b style="width:${r.v}%"></b></i><strong>${r.v}%</strong></div>`).join('')}${sum.penalty?`<div class="aarNote">Penalty −${sum.penalty} pts (${c.falseEsc||0} false escalation(s), ${c.premature||0} premature decision(s))</div>`:''}</div><div class="instructor card"><div class="cardHead">AI INSTRUCTOR FEEDBACK</div><div class="feedback"><div>✦</div><p><b>${esc(cfg.name)} coaching.</b><br>${fb}</p></div><button class="primary" data-recommended="${esc(reco.id)}">Start Recommended Training →</button></div><div class="timeline card"><div class="cardHead">SESSION TIMELINE</div>${d.events.slice(-8).map(e=>`<div class="timeRow"><span>${esc(e[0])}</span><i></i><b>${esc(e[1])}</b></div>`).join('')}</div><div class="replay card"><div class="cardHead">REPLAY</div><div class="replayImg" style="background-image:linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.5)),url(${A+cfg.card.img});background-size:cover;background-position:center"><button data-replay>▶</button></div><small>${esc(sum.name)} • event-driven session reconstruction</small></div><div class="next card"><div class="cardHead">NEXT RECOMMENDED</div><div class="recommend" style="background-image:linear-gradient(0deg,#000b,transparent),url(${A+rc.card.img})"><div><span>${esc(rc.name.toUpperCase())}</span><span>${esc(rc.difficulty.toUpperCase())}</span></div></div><small class="aarNote">${esc(reco.reason)}</small><button class="primary" data-recommended="${esc(reco.id)}">Start Next Mission →</button></div><div class="aarWide card"><div class="cardHead">MISSION OBJECTIVES & SCENARIO EVENTS</div><div class="aarWideGrid"><div>${objs.length?objs.map(o=>`<div class="objRow ${o.done?'done':o.failed?'fail':''}"><i>${o.done?'✓':o.failed?'✕':'○'}</i><span>${esc(o.text)}</span><em>${esc(o.show)}</em></div>`).join(''):'<div class="objRow"><span>No objective data for this saved session.</span></div>'}<div class="aarCounters">${sum.legacy?'':`<span>Contacts <b>${sum.contacts}</b></span><span>Clutter <b>${sum.clutter}</b></span><span>Decisions <b>${sum.decisions}</b></span><span>Events <b>${sum.eventsTriggered}</b></span><span>Missed <b>${c.missed||0}</b></span><span>False esc. <b>${c.falseEsc||0}</b></span>`}</div></div><div>${evs.length?evs.map(e=>`<div class="timeRow"><span>${esc(e[0])}</span><i></i><b>${esc(e[1])}</b></div>`).join(''):'<div class="timeRow"><b>No scenario events recorded.</b></div>'}</div></div></div></div></main>`;
  }

  function readiness(){const latest=state.history[0]?.stats||defaultStats;const avg=Math.round(state.history.reduce((a,h)=>a+h.score,0)/Math.max(1,state.history.length));const readiness=Math.min(99,Math.round(avg*.8+16));const played=new Set(state.history.map(h=>h.sid||idByName(h.mission))).size;const coverage=Math.round(played/AS.ORDER.length*100);return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">TRAINING READINESS</span><h1>Readiness Passport</h1><p>Persistent simulated performance profile.</p></div><button class="primary" data-nav="training">Continue Training →</button></div><section class="readinessHero card"><div class="readinessRing" style="background:conic-gradient(#2de2b0 0 ${readiness}%,#0b2734 ${readiness}% 100%)"><div><b>${readiness}</b><span>/100</span></div></div><div class="readinessIdentity"><span class="eyebrow">TRAINEE PROFILE</span><h2>DEEPAK</h2><div class="statusBadge"><i></i> ${readiness>=90?'MISSION READY':readiness>=80?'ADVANCED READY':'DEVELOPING'}</div><p>Training memory carries recent performance forward so future sessions can target weaker areas.</p><div class="readinessStats"><div><b>${state.history.length}</b><span>SESSIONS</span></div><div><b>${coverage}%</b><span>SCENARIO COVERAGE</span></div><div><b>${avg}%</b><span>AVG SCORE</span></div></div></div></section><div class="metricGrid" style="margin-top:10px">${[['Detection',latest.detection],['Classification',latest.classification],['Decision',latest.decision],['Response',latest.response]].map(x=>`<div class="metricCard"><b>${x[1]}%</b><span>${x[0]}</span></div>`).join('')}</div></main>`}

  function instructor(){const s=state.session;return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">INSTRUCTOR COMMAND CENTER</span><h1>Live Training Oversight</h1><p>Observe the synthetic trainee session.</p></div><span class="statusPill"><i></i> ${s?.running?'TRAINEE LINK ACTIVE':'WAITING FOR TRAINEE'}</span></div><div class="simpleGrid"><article class="simpleCard"><span class="eyebrow cyan">LIVE SCORE</span><h3 style="font-size:28px">${s?.stats.score||86}</h3><p>Detection ${s?.stats.detection||92}% • Decision ${s?.stats.decision||82}%</p></article><article class="simpleCard"><span class="eyebrow cyan">SESSION</span><h3>${esc(s?.mission.name||'Waiting for trainee')}</h3><p>${s?.events?.length||0} recorded events • ${s?.running?'LIVE':'IDLE'}</p></article><article class="simpleCard"><span class="eyebrow cyan">INSTRUCTOR TOOLS</span><p>Evaluation-only controls for observations and AAR review.</p><button class="outline" data-nav="analytics">Open AAR →</button></article></div><div class="card" style="margin-top:10px"><div class="cardHead">EVENT STREAM</div>${(s?.events||[['—','Waiting for trainee telemetry']]).slice(-10).reverse().map(e=>`<div class="timeRow"><span>${esc(e[0])}</span><i></i><b>${esc(e[1])}</b></div>`).join('')}</div></main>`}

  function command(){const s=state.session;return `<main class="page"><div class="pageTop"><div><span class="eyebrow cyan">COMMAND DECK • IMMERSIVE SIMULATION</span><h1>AI Instructor <em>Mission Control</em></h1><p>Simulation command view for coaching, sensor fusion and event pressure.</p></div><span class="statusPill"><i></i> ${s?.running?'LIVE TRAINING':'STANDBY'}</span></div><div class="metricGrid"><div class="metricCard"><b>4</b><span>SENSOR FEEDS</span></div><div class="metricCard"><b>${s?.contacts?s.contacts.filter(c=>c.state!=='gone').length:0}</b><span>CONTACTS</span></div><div class="metricCard"><b>${s?.stats?.score||86}</b><span>LIVE SCORE</span></div><div class="metricCard"><b>${s?.events?.length||0}</b><span>EVENTS</span></div></div><div class="card" style="margin-top:10px"><div class="cardHead">INSTRUCTOR COACHING</div><p style="font-size:11px;color:#a6bdc8;line-height:1.6">The AI instructor observes simulated decisions, explains training consequences and feeds the after-action review. All contacts and actions are synthetic.</p><button class="primary" data-nav="training">Return to Training →</button></div></main>`}

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
    const t=e.target&&e.target.closest?e.target.closest('[data-contact],[data-decision],[data-mark-drone],[data-end-session],[data-tab],[data-lock],[data-view]'):null;
    if(!t||!root.contains(t))return;
    try{
      const s=state.session;if(!s||!s.running||state.page!=='training')return;
      if(t.hasAttribute('data-contact')){s.selected=t.dataset.contact;patchTraining()}
      else if(t.hasAttribute('data-decision'))decision(t.dataset.decision);
      else if(t.hasAttribute('data-end-session'))finishSession();
      else if(t.hasAttribute('data-tab')){s.tab=t.dataset.tab;if(state.world&&state.world.setThermal)state.world.setThermal(s.tab==='Thermal');patchTraining()}
      else if(t.hasAttribute('data-lock'))lockNearest();
      else if(t.hasAttribute('data-view'))toggleView();
      else if(t.hasAttribute('data-mark-drone')){decision('Classify')}
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
    document.querySelectorAll('[data-start-scenario]').forEach(b=>b.onclick=()=>startTraining(b.dataset.startScenario));
    document.querySelector('[data-start-generated]')?.addEventListener('click',()=>startSession({id:state.generated.id,difficulty:state.generated.difficulty}));
    document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
    document.querySelector('[data-action="generate"]')?.addEventListener('click',()=>{const last=state.history[0];const rec=last&&last.summary?AS.recommend(last.summary):{id:AS.ORDER[Math.floor(Math.random()*AS.ORDER.length)]};const c=AS.SCENARIOS[rec.id],order=['Medium','High','Very High','Extreme'],nd=order[Math.min(3,order.indexOf(c.difficulty)+1)];state.generated={id:rec.id,name:'Adaptive '+c.name,threats:c.threatShort,time:c.time,weather:c.weather,difficulty:nd};toast('AI training mission generated');render()});
    document.querySelectorAll('[data-replay]').forEach(b=>b.onclick=openReplay);
    document.querySelector('[data-action="report"]')?.addEventListener('click',()=>{const blob=new Blob([JSON.stringify({platform:'AEROSHIELD',scenario:aarData().sum,events:aarData().events,simulationOnly:true},null,2)],{type:'application/json'});const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='AEROSHIELD-AAR-report.json';a.click();URL.revokeObjectURL(u);toast('AAR report downloaded')});
    document.querySelectorAll('[data-recommended]').forEach(b=>b.onclick=()=>startTraining(b.dataset.recommended||'mixed'));
  }
  render();
})();
