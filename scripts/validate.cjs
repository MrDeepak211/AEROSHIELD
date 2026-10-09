// AEROSHIELD static validation: syntax + every referenced asset must exist.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..');let bad=0;
const fail=m=>{console.error('✗ '+m);bad++};
for(const f of ['app.js','engine.js','scenarios.js','world3d.js','server.cjs']){const r=cp.spawnSync(process.execPath,['--check',path.join(root,f)]);r.status===0?console.log('✓ syntax '+f):fail('syntax error in '+f+'\n'+r.stderr)}
const exists=p=>fs.existsSync(path.join(root,p));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)){exists(m[1])?console.log('✓ index.html → '+m[1]):fail('index.html references missing file '+m[1])}
const appJs=fs.readFileSync(path.join(root,'app.js'),'utf8');const js=appJs+fs.readFileSync(path.join(root,'scenarios.js'),'utf8');
const names=new Set([...js.matchAll(/['"`}]([\w.-]+\.(?:jpg|png|svg|jpeg))/g)].map(m=>m[1]));
for(const n of names){exists('assets/'+n)?console.log('✓ asset '+n):fail('app.js references missing asset assets/'+n)}
for(const css of ['styles.css','final.css','scenario.css']){const t=fs.readFileSync(path.join(root,css),'utf8');for(const m of t.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)){if(/^(data:|https?:)/.test(m[1]))continue;exists(m[1])?0:fail(css+' references missing '+m[1])}}
// invalid self-closing non-void tags inside templates (root cause of the Training layout collapse)
const void_=new Set(['img','input','br','hr','meta','link','rect','circle','ellipse','line','polyline','polygon','path','stop']); // HTML void elements + SVG primitives (valid self-closing inside <svg>)
for(const m of appJs.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)((?:[^<>]|=>)*?)\/>/g)){if(!void_.has(m[1]))fail('invalid self-closing tag in app.js: '+m[0])}
// ---- every <script src>/<link href> in index.html must exist (incl. vendored three.js) ----
for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/(?:src|href)="([^"#?]+\.(?:js|css))"/g)){if(!fs.existsSync(path.join(root,m[1])))fail('index.html references missing file: '+m[1])}
if(!fs.existsSync(path.join(root,'vendor','three.min.js')))fail('vendor/three.min.js missing (3D world needs it)');else console.log('✓ vendored three.js present (offline, no CDN)');
// ---- 3D runtime files referenced by index.html must exist (vendored three.js: no CDN needed) ----
for(const m of fs.readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<script src="([^"]+)"/g)){
  if(!fs.existsSync(path.join(root,m[1])))fail('index.html references missing script '+m[1]);
}
if(!fs.existsSync(path.join(root,'vendor','three.min.js')))fail('vendor/three.min.js missing (3D world cannot start)');
else console.log('✓ vendored three.js present ('+Math.round(fs.statSync(path.join(root,'vendor','three.min.js')).size/1024)+' KB), world3d.js loads after it');
const idx=fs.readFileSync(path.join(root,'index.html'),'utf8');
if(!(idx.indexOf('three.min.js')<idx.indexOf('world3d.js')&&idx.indexOf('world3d.js')<idx.indexOf('app.js')))fail('script order must be three.min.js -> world3d.js -> app.js');
// ---- scenario library + engine contract (headless) ----
try{
  const N=require(path.join(root,'scenarios.js'));require(path.join(root,'engine.js'));
  const probs=N.validate();probs.length?probs.forEach(p=>fail('scenario data: '+p)):console.log('✓ scenario data: 6 scenarios, weights sum to 1, metrics/types/sensors defined');
  const sig=new Set(),counts={};
  for(const id of N.ORDER){
    const sim=N.createSim(id,{seed:7});counts[id]=sim.contacts.length;
    for(let i=0;i<sim.cfg.durationSec&&sim.running;i++)N.tick(sim);
    N.finalize(sim);const sum=N.summary(sim);
    if(!(sum.score>=0&&sum.score<=100))fail(id+': score out of range '+sum.score);
    if(sim.counters.eventsTriggered<3)fail(id+': director fired only '+sim.counters.eventsTriggered+' events');
    if(sim.frames.length<10)fail(id+': replay frames not recorded');
    sig.add(JSON.stringify([sim.cfg.scoringWeights,sim.cfg.aarMetrics,Object.keys(sim.cfg.contactTypes)]));
    console.log(`✓ engine ${id}: ${sim.counters.spawned} contacts spawned, ${sim.counters.eventsTriggered} director events, ${sim.frames.length} replay frames`);
  }
  if(sig.size!==6)fail('scenarios are not all distinct (scoring/metrics/contact mix)');
  const ok=(id,lo,hi)=>{let mn=99,mx=0;for(let sd=1;sd<=100;sd++){const n=N.createSim(id,{seed:sd}).contacts.length;mn=Math.min(mn,n);mx=Math.max(mx,n)}if(mn<lo||mx>hi)fail(`${id}: initial contacts ${mn}-${mx} outside ${lo}-${hi}`)};
  ok('urban',2,4);ok('border',1,3);ok('night',2,4);ok('swarm',8,15);ok('degraded',2,4);ok('mixed',4,10);
  console.log('✓ initial contact counts within spec for all scenarios (100 seeds each)');
}catch(e){fail('engine contract: '+e.stack)}
if(bad){console.error(`\nValidation FAILED (${bad} problem${bad>1?'s':''})`);process.exit(1)}
console.log('\nValidation passed.');
