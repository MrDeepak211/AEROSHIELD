// AEROSHIELD static validation: syntax + every referenced asset must exist.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.join(__dirname,'..');let bad=0;
const fail=m=>{console.error('✗ '+m);bad++};
for(const f of ['app.js','server.cjs']){const r=cp.spawnSync(process.execPath,['--check',path.join(root,f)]);r.status===0?console.log('✓ syntax '+f):fail('syntax error in '+f+'\n'+r.stderr)}
const exists=p=>fs.existsSync(path.join(root,p));
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
for(const m of html.matchAll(/(?:src|href)="([^"#?]+)"/g)){exists(m[1])?console.log('✓ index.html → '+m[1]):fail('index.html references missing file '+m[1])}
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
const names=new Set([...js.matchAll(/['"`}]([\w.-]+\.(?:jpg|png|svg|jpeg))/g)].map(m=>m[1]));
for(const n of names){exists('assets/'+n)?console.log('✓ asset '+n):fail('app.js references missing asset assets/'+n)}
for(const css of ['styles.css','final.css']){const t=fs.readFileSync(path.join(root,css),'utf8');for(const m of t.matchAll(/url\(['"]?([^'")]+)['"]?\)/g)){if(/^(data:|https?:)/.test(m[1]))continue;exists(m[1])?0:fail(css+' references missing '+m[1])}}
// invalid self-closing non-void tags inside templates (root cause of the Training layout collapse)
const void_=new Set(['img','input','br','hr','meta','link']);
for(const m of js.matchAll(/<([a-zA-Z][a-zA-Z0-9]*)((?:[^<>]|=>)*?)\/>/g)){if(!void_.has(m[1]))fail('invalid self-closing tag in app.js: '+m[0])}
if(bad){console.error(`\nValidation FAILED (${bad} problem${bad>1?'s':''})`);process.exit(1)}
console.log('\nValidation passed.');
