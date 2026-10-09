# AEROSHIELD scenario acceptance test (real Chromium via Playwright, deterministic fake clock).
# Needs: pip install playwright && playwright install chromium ; server running on :5173  (npm start)
# Plays every scenario ~170 simulated seconds in the 3D world (two-stick flight, decisions), then verifies Training, AAR and Replay.
# Chromium is started with software WebGL (SwiftShader) so it works on machines without a GPU.
import re, sys, json, io
from PIL import Image, ImageStat
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173'
SIM_SECONDS = 170
R = []; errs = []; bad = []
def ok(name, cond, extra=''):
    R.append((name, bool(cond), extra)); print(('PASS ' if cond else 'FAIL ') + name + (('  [' + str(extra) + ']') if extra != '' else ''))
def norm(t): return re.sub(r'\s+', ' ', t)

EXPECT = {
 'urban':   dict(name='Urban Perimeter',     env='Dense Urban City',          theme='theme-urban',    n=(2,4),  objective='Classify urban contacts while minimizing false positives.',
                 weights=['Classification 35%','Tracking 25%','Situational Awareness 20%','Response Timing 20%'], chips=['CLUTTER','PARTIAL BLOCK','INTERMITTENT','NOISY'],
                 events=['behind building','False-positive','cross paths'], aar=['Classification','False-Positive Handling','Tracking','Response Timing'], not_aar=['Prioritization','Sensor Fusion'], tab='EO/IR'),
 'border':  dict(name='Border Surveillance', env='Mountainous Border Terrain', theme='theme-border',   n=(1,3),  objective='Detect and maintain long-range track continuity.',
                 weights=['Detection 35%','Tracking 30%','Classification 20%','Response Timing 15%'], chips=['LONG RANGE','TERRAIN MASK','INTERMITTENT','WEAK'],
                 events=['mountain terrain','confirmation delayed','another direction','Terrain masking'], aar=['Detection','Tracking','Confidence Management','Classification'], not_aar=['Prioritization','Sensor Fusion'], tab='Radar'),
 'night':   dict(name='Night Infiltration',  env='Dark Urban / Rural Boundary', theme='theme-night',   n=(2,4),  objective='Correlate low-visibility sensor evidence.',
                 weights=['Detection 30%','Sensor Fusion 30%','Classification 25%','Response Timing 15%'], chips=['LOW RCS','THERMAL PRIMARY','INTERMITTENT','DEGRADED'],
                 events=['Thermal signature','appears briefly','Radar confidence drops','RF signal disappears'], aar=['Detection','Sensor Fusion','False-Positive Handling','Response Timing'], not_aar=['Prioritization','Tracking'], tab='Thermal'),
 'swarm':   dict(name='Swarm Attack',        env='Open / Semi-Urban Field',   theme='theme-swarm',    n=(8,12), objective='Maintain situational awareness across multiple contacts.',
                 weights=['Situational Awareness 35%','Prioritization 30%','Tracking 20%','Response Timing 15%'], chips=['OVERLOAD RISK','MULTI-TARGET','OVERLAPPING','NOISY'],
                 events=['Swarm expansion','merge visually','Sensor overload','swarm direction change','outside the observation area'], aar=['Situational Awareness','Prioritization','Tracking','Detection'], not_aar=['Sensor Fusion','Confidence Management'], tab='Radar'),
 'degraded':dict(name='Degraded Sensors',    env='Rural / Industrial Site',   theme='theme-degraded', n=(2,4),  objective='Make sound decisions under incomplete sensor information.',
                 weights=['Sensor Fusion 35%','Decision Quality 30%','Confidence Management 20%','Response Timing 15%'], chips=['INTERMITTENT','NOISY','OFFLINE','LOW CONFIDENCE'],
                 events=['Radar outage','EO/IR degradation','RF blackout','Sensor recovery','Conflicting sensor'], aar=['Sensor Fusion','Decision Quality','Confidence Management','Response Timing'], not_aar=['Prioritization','Detection'], tab='EO/IR'),
 'mixed':   dict(name='Mixed Threats',       env='Mixed Urban + Rural Terrain', theme='theme-mixed',   n=(4,10), objective='Demonstrate complete adaptive threat recognition capability.',
                 weights=['Detection 12.5%','Classification 12.5%','Tracking 12.5%','Sensor Fusion 12.5%','Situational Awareness 12.5%','Response Timing 12.5%','Decision Quality 12.5%','Prioritization 12.5%'], chips=['NOMINAL','INTERMITTENT','NOISY'],
                 events=['Environment change','Sensor conflict','False positive','Multiple contacts appear','Single contact enters'], aar=['Detection','Classification','Tracking','Decision Quality','Situational Awareness','Sensor Fusion','Response Timing','Prioritization'], not_aar=[], tab='EO/IR'),
}
ORDER = ['urban','border','night','swarm','degraded','mixed']
SIG = {}

PIXELS = {}
def frame_stats(pg, sid):
    """render ONE real frame and read the WebGL canvas back in the same task (non-blank + visually distinct per scenario)"""
    import base64
    url = pg.evaluate("""(()=>{const w=AeroShield.world;AeroShield.World.noRender=false;w.update(0.05,{lx:0,ly:0,rx:0,ry:0});
      const u=w.renderer.domElement.toDataURL('image/png');AeroShield.World.noRender=true;return u})()""")
    im = Image.open(io.BytesIO(base64.b64decode(url.split(',', 1)[1]))).convert('RGB').resize((96, 40)); st = ImageStat.Stat(im)
    PIXELS[sid] = [round(v) for v in st.mean]
    return sum(st.stddev) / 3, st.mean
FACE = """(i)=>{const w=AeroShield.world;if(!w||w.fallback)return null;const arr=Array.from(w.meshes.values()).filter(r=>r.c.state==='active');if(!arr.length)return null;
  const r=arr[i%arr.length],p=w.player,dx=r.target.x-p.x,dz=r.target.z-p.z;p.yaw=((Math.atan2(dx,-dz))+Math.PI*2)%(Math.PI*2);w.update(0.001);return r.c.n}"""
def play(pg, secs):
    """advance the fake clock one second at a time; every 4 s the trainee turns the drone toward the next contact, locks it and decides"""
    cyc = 0
    pg.evaluate("AeroShield.World.noRender=true")   # fast-forward without GPU work; physics, projection and sensors still run
    for t in range(secs):
        pg.clock.run_for(1000)
        if t % 4 == 1:
            try:
                name = pg.evaluate(FACE, cyc); cyc += 1
                if not name: continue
                pg.clock.run_for(60)
                pg.keyboard.press('e')
                sel = pg.evaluate("document.querySelector('.contact h3').textContent")
                if sel != name:
                    m = pg.locator(f'#markerLayer .contactMark[data-contact="{name}"]')
                    if m.count(): m.first.click(timeout=800, force=True)
                cls = pg.evaluate(f"(document.querySelector('#markerLayer .contactMark[data-contact=\"{name}\"]')||{{}}).className||''")
                txt = pg.evaluate(f"(document.querySelector('#markerLayer .contactMark[data-contact=\"{name}\"]')||{{}}).innerText||''")
                mm = re.search(r'(\d+)%', txt); conf = int(mm.group(1)) if mm else 0
                if 'tracked' not in cls: act = 'Track'
                elif conf >= 60 and 'clsDrone' not in cls: act = 'Classify'
                else: act = 'Monitor'
                pg.click(f'[data-decision="{act}"]', timeout=1500)
            except Exception:
                pass

with sync_playwright() as p:
    b = p.chromium.launch(args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
    ctx = b.new_context(viewport={'width': 1440, 'height': 900})
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append((m.type, m.text)) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errs.append(('pageerror', str(e))))
    pg.on('response', lambda r: bad.append((r.status, r.url)) if r.status >= 400 else None)
    pg.on('requestfailed', lambda r: bad.append(('failed', r.url)))
    pg.clock.install()
    pg.goto(URL); pg.clock.run_for(600)

    for name in ['features', 'scenarios', 'readiness', 'instructor', 'command', 'judge', 'about', 'analytics', 'home']:
        pg.click(f'nav [data-nav="{name}"]'); pg.clock.run_for(150)
        ok('page renders: ' + name, pg.locator('main').count() == 1 and pg.inner_text('main').strip() != '')
    pg.click('nav [data-nav="scenarios"]'); pg.clock.run_for(100)
    ok('scenario library lists 6 cards each with its own start id', pg.locator('[data-start-scenario]').evaluate_all('e=>e.map(x=>x.dataset.startScenario)') == ORDER)
    ok('startTraining() is exposed', pg.evaluate("typeof window.startTraining==='function'"))

    for sid in ORDER:
        E = EXPECT[sid]
        print('\n=== ' + sid.upper() + ' ===')
        pg.click('nav [data-nav="scenarios"]'); pg.clock.run_for(150)
        pg.click(f'[data-start-scenario="{sid}"]'); pg.clock.run_for(300)
        ok(f'[{sid}] Training screen rendered (no blank)', pg.locator('.trainingPage').count() == 1 and pg.locator('#battlefield').count() == 1)
        ok(f'[{sid}] correct scenario loaded', pg.get_attribute('.trainingPage', 'data-scenario') == sid)
        mi = norm(pg.inner_text('.mission'))
        ok(f'[{sid}] mission name', E['name'] in mi, E['name'])
        ok(f'[{sid}] environment', E['env'] in mi, E['env'])
        bfc = pg.get_attribute('#battlefield', 'class')
        ok(f'[{sid}] background/theme class', E['theme'] in bfc, bfc)
        pg.evaluate("AeroShield.World.noRender=true")
        sd, mean = frame_stats(pg, sid)
        # a blank canvas has std ~0; the night world is intentionally low-contrast, so its threshold is lower
        ok(f'[{sid}] 3D view renders real pixels (not blank)', sd > (6 if sid == 'night' else 12), f'std {sd:.0f}, mean {[round(v) for v in mean]}')
        ok(f'[{sid}] real 3D world (WebGL canvas, not the flat fallback)', pg.locator('#world3d canvas.world3dCanvas').count() == 1 and pg.evaluate('!AeroShield.world.fallback'))
        ok(f'[{sid}] 3D scene has geometry', pg.evaluate('AeroShield.world.scene.children.length') > 8, pg.evaluate('AeroShield.world.scene.children.length'))
        n0 = pg.locator('#markerLayer .contactMark').count()
        ok(f'[{sid}] initial contact count within spec {E["n"]}', E['n'][0] <= n0 <= E['n'][1], n0)
        ok(f'[{sid}] objective text', E['objective'] in norm(pg.inner_text('#objBox')))
        wt = norm(pg.inner_text('#objBox'))
        ok(f'[{sid}] scoring weights', all(w in wt for w in E['weights']), [w for w in E['weights'] if w not in wt])
        chips = norm(pg.inner_text('.sensorChips'))
        ok(f'[{sid}] sensor behaviour chips', all(c in chips for c in E['chips']), chips)
        ok(f'[{sid}] default sensor view', norm(pg.inner_text('.sensorTabs button.on')) == E['tab'], pg.inner_text('.sensorTabs button.on'))
        ok(f'[{sid}] adaptive panel shows difficulty-driven values', 'speed ×' in pg.inner_text('#adaptive'), norm(pg.inner_text('#adaptive'))[:90])
        SIG[sid] = (bfc.split()[1], n0, chips, wt[:80])
        if sid == 'swarm': ok('[swarm] priority tags (P1/P2/P3) displayed at start', pg.locator('#markerLayer .contactMark .prio').count() >= 1, pg.locator('#markerLayer .contactMark .prio').count())

        # ---------- two-stick flight (deterministic physics via the world's own update) ----------
        PL = lambda: pg.evaluate("(()=>{const p=AeroShield.world.player;return [p.x,p.y,p.z,p.yaw*180/Math.PI]})()")
        STEP = lambda inp, n=40: pg.evaluate("([inp,n])=>{const w=AeroShield.world;for(let i=0;i<n;i++)w.update(0.05,inp)}", [inp, n])
        pg.evaluate("(()=>{const w=AeroShield.world,p=w.player;p.x=0;p.z=-60;p.y=60;p.yaw=0;p.vf=p.vs=p.vy=p.yawRate=0})()")
        a0 = PL(); STEP(dict(lx=0, ly=0, rx=0, ry=1)); a1 = PL()
        ok(f'[{sid}] RIGHT stick up flies forward (north) and nothing else', a1[2] < a0[2] - 25 and abs(a1[1] - a0[1]) < 1 and abs(a1[3] - a0[3]) < 1, [round(v, 1) for v in a1])
        STEP(dict(lx=0, ly=0, rx=0, ry=0), 40)
        a0 = PL(); STEP(dict(lx=0, ly=0, rx=1, ry=0)); a1 = PL()
        ok(f'[{sid}] RIGHT stick right strafes east without yawing', a1[0] > a0[0] + 20 and abs(a1[3] - a0[3]) < 1, [round(v, 1) for v in a1])
        STEP(dict(lx=0, ly=0, rx=0, ry=0), 40)
        a0 = PL(); STEP(dict(lx=0, ly=1, rx=0, ry=0), 25); a1 = PL()
        ok(f'[{sid}] LEFT stick up = throttle/climb (position unchanged)', a1[1] > a0[1] + 8 and abs(a1[0] - a0[0]) < 1 and abs(a1[2] - a0[2]) < 1, [round(v, 1) for v in a1])
        STEP(dict(lx=0, ly=-1, rx=0, ry=0), 25); a2 = PL()
        ok(f'[{sid}] LEFT stick down = descend', a2[1] < a1[1] - 8, [round(v, 1) for v in a2])
        STEP(dict(lx=0, ly=0, rx=0, ry=0), 40)
        a0 = PL(); STEP(dict(lx=1, ly=0, rx=0, ry=0), 20); a1 = PL()
        ok(f'[{sid}] LEFT stick right = yaw clockwise (heading changes, position unchanged)', ((a1[3] - a0[3]) % 360) > 20 and ((a1[3] - a0[3]) % 360) < 180 and abs(a1[0] - a0[0]) < 1.5 and abs(a1[2] - a0[2]) < 1.5, [round(v, 1) for v in a1])
        STEP(dict(lx=0, ly=0, rx=0, ry=0), 40)
        # forward after yaw follows the new heading (camera + movement are body-relative)
        pg.evaluate("(()=>{const p=AeroShield.world.player;p.yaw=Math.PI/2;p.vf=p.vs=p.vy=p.yawRate=0;p.x=0;p.z=-60})()")
        a0 = PL(); STEP(dict(lx=0, ly=0, rx=0, ry=1)); a1 = PL()
        ok(f'[{sid}] forward is relative to heading (east when yawed 90 deg)', a1[0] > a0[0] + 25 and abs(a1[2] - a0[2]) < 3, [round(v, 1) for v in a1])
        # world bounds + ground clamp
        pg.evaluate("(()=>{const w=AeroShield.world,p=w.player;p.x=5000;p.z=5000;p.y=-50;w.update(0.05,{lx:0,ly:0,rx:0,ry:0})})()")
        bnd = PL(); ok(f'[{sid}] drone is kept inside the world bounds and above ground', abs(bnd[0]) <= 1151 and bnd[2] <= 61 and bnd[1] >= 3, [round(v, 1) for v in bnd])
        # physical sensor platform: range to a contact changes when the drone flies toward it
        pg.evaluate("(()=>{const w=AeroShield.world,p=w.player;p.x=0;p.z=-10;p.y=40;p.vf=p.vs=p.vy=p.yawRate=0;w.update(0.05,{lx:0,ly:0,rx:0,ry:0})})()")
        r0 = pg.evaluate("(()=>{const s=AeroShield.world.sim;const c=s.contacts.find(c=>c.state==='active');return c?AeroShield.rangeKm(s,c):null})()")
        pg.evaluate("(()=>{const w=AeroShield.world,p=w.player,s=w.sim,c=s.contacts.find(c=>c.state==='active'),r=w.meshes.get(c.n);const dx=r.target.x-p.x,dz=r.target.z-p.z;p.x+=dx*.7;p.z+=dz*.7;w.update(0.05,{lx:0,ly:0,rx:0,ry:0})})()")
        r1 = pg.evaluate("(()=>{const s=AeroShield.world.sim;const c=s.contacts.find(c=>c.state==='active');return c?AeroShield.rangeKm(s,c):null})()")
        ok(f'[{sid}] sensors are measured from the flying drone (range shrinks as it closes in)', r0 is not None and r1 is not None and r1 < r0 * 0.6, [r0, r1])
        # on-screen sticks (pointer) drive the same controls; release re-centres
        L = pg.locator('#stickL').bounding_box(); lx0, ly0 = L['x'] + L['width'] / 2, L['y'] + L['height'] / 2
        pg.evaluate("(()=>{const p=AeroShield.world.player;p.x=0;p.z=-60;p.y=60;p.yaw=0;p.vf=p.vs=p.vy=p.yawRate=0})()")
        THUMB = lambda id_: pg.evaluate("(id)=>{const t=document.getElementById(id).style.transform;return Array.from(t.matchAll(/([+-])\\s*([\\d.]+)px/g)).map(m=>(m[1]==='-'?-1:1)*parseFloat(m[2]))}", id_)
        pg.mouse.move(lx0, ly0); pg.mouse.down(); pg.mouse.move(lx0, ly0 - 34, steps=3); pg.clock.run_for(500)
        tl = THUMB('thumbL'); tr_during = THUMB('thumbR')
        ok(f'[{sid}] left on-screen stick thumb follows the pointer (pushed up)', len(tl) == 2 and tl[1] < -15 and abs(tl[0]) < 6, tl)
        ok(f'[{sid}] right stick stays centred while the left one is used', len(tr_during) == 2 and abs(tr_during[0]) < 1 and abs(tr_during[1]) < 1, tr_during)
        pg.mouse.up(); pg.clock.run_for(300)
        tl2 = THUMB('thumbL'); ok(f'[{sid}] left stick re-centres on release', len(tl2) == 2 and abs(tl2[0]) < 1 and abs(tl2[1]) < 1, tl2)
        Rb = pg.locator('#stickR').bounding_box(); rx0, ry0 = Rb['x'] + Rb['width'] / 2, Rb['y'] + Rb['height'] / 2
        pg.mouse.move(rx0, ry0); pg.mouse.down(); pg.mouse.move(rx0 + 30, ry0, steps=3); pg.clock.run_for(500)
        trr = THUMB('thumbR'); tl_during = THUMB('thumbL'); pg.mouse.up(); pg.clock.run_for(300)
        ok(f'[{sid}] right on-screen stick pushed right moves independently', len(trr) == 2 and trr[0] > 15 and abs(trr[1]) < 6, trr)
        ok(f'[{sid}] left stick stays centred while the right one is used', len(tl_during) == 2 and abs(tl_during[0]) < 1 and abs(tl_during[1]) < 1, tl_during)
        # keyboard maps to the same two sticks
        pg.keyboard.down('ArrowUp'); pg.clock.run_for(300)
        kv = pg.evaluate("(()=>{const t=document.getElementById('thumbR').style.transform;return t})()"); pg.keyboard.up('ArrowUp'); pg.clock.run_for(200)
        ok(f'[{sid}] keyboard arrows drive the RIGHT stick', '-' in kv.split(',')[1] or 'calc(-50% - ' in kv, kv[:70])
        pg.keyboard.down('w'); pg.clock.run_for(300)
        kv = pg.evaluate("document.getElementById('thumbL').style.transform"); pg.keyboard.up('w'); pg.clock.run_for(200)
        ok(f'[{sid}] W/A/S/D drive the LEFT stick', 'calc(-50% - ' in kv.split(',')[1], kv[:70])
        # camera views + lock
        v0 = pg.evaluate("AeroShield.world.view"); pg.keyboard.press('v'); pg.clock.run_for(200); v1 = pg.evaluate("AeroShield.world.view")
        ok(f'[{sid}] V toggles chase / first-person view', v0 != v1, f'{v0}->{v1}'); pg.keyboard.press('v'); pg.clock.run_for(200)
        pg.evaluate(FACE, 0); pg.clock.run_for(100); pg.keyboard.press('e'); pg.clock.run_for(100)
        ok(f'[{sid}] E locks the contact under the crosshair', pg.evaluate("document.querySelector('.contact h3').textContent").startswith('CONTACT'))
        ok(f'[{sid}] live flight HUD', pg.evaluate("document.getElementById('hudHdg').textContent").isdigit() and pg.evaluate("parseInt(document.getElementById('hudAlt').textContent)") > 0)
        ok(f'[{sid}] markers are projected onto 3D positions', pg.evaluate("Array.from(document.querySelectorAll('#markerLayer .contactMark')).some(m=>m.style.transform.includes('translate('))"))
        ok(f'[{sid}] camera moves with the drone (view is not a static image)', pg.evaluate("(()=>{const w=AeroShield.world,p=w.player;const c0=w.camera.position.clone();p.x+=120;p.z-=80;w.camPosInit=false;w.update(0.05,{lx:0,ly:0,rx:0,ry:0});return w.camera.position.distanceTo(c0)>80})()"))
        pg.click('[data-decision="Track"]'); pg.clock.run_for(100)
        ok(f'[{sid}] decision toast', 'Track decision recorded' in pg.inner_text('.toast'))
        ok(f'[{sid}] decision feedback shown', pg.locator('#feedback .fb').count() == 1, norm(pg.inner_text('#feedback'))[:70])
        pg.click('.sensorTabs button:has-text("Radar")'); pg.clock.run_for(100)
        ok(f'[{sid}] sensor tab switches feed', norm(pg.inner_text('.sensor .cardHead')).endswith('Radar') and pg.locator('.feedSvg').count() == 1)
        pg.click('.sensorTabs button:has-text("' + E['tab'] + '")'); pg.clock.run_for(100)

        t0 = pg.inner_text('#tClock'); pg.clock.run_for(2000); t1 = pg.inner_text('#tClock')
        ok(f'[{sid}] timer advances', t0 != t1, f'{t0}->{t1}')

        play(pg, SIM_SECONDS)
        ok(f'[{sid}] still running after {SIM_SECONDS}s (no crash)', pg.locator('#battlefield').count() == 1 and pg.locator('#tClock').count() == 1)
        if sid == 'mixed':
            ok('[mixed] environment change applied (rain phase + weather)', 'ph1' in pg.get_attribute('#fxLayer', 'class') and 'Rain' in pg.inner_text('#missionInfo'), pg.get_attribute('#fxLayer', 'class'))

        pg.click('[data-end-session]'); pg.clock.run_for(400)
        ok(f'[{sid}] AAR opened', 'AFTER-ACTION REVIEW' in pg.inner_text('main').upper())
        ok(f'[{sid}] AAR identifies scenario', pg.get_attribute('main', 'data-scenario') == sid and E['name'] in pg.inner_text('main'))
        perf = norm(pg.inner_text('.performance'))
        ok(f'[{sid}] AAR uses scenario metrics', all(a in perf for a in E['aar']), [a for a in E['aar'] if a not in perf])
        ok(f'[{sid}] AAR omits other scenarios\' metrics', all(a not in perf for a in E['not_aar']), [a for a in E['not_aar'] if a in perf])
        ok(f'[{sid}] AAR shows threats and 4 sensors', re.search(r'threats\s*\d+', perf, re.I) is not None and re.search(r'sensors\s*4', perf, re.I) is not None)
        ok(f'[{sid}] AAR lists scenario objectives', pg.locator('.aarWide .objRow').count() >= 3)
        if sid in ('urban', 'swarm', 'degraded'): pg.screenshot(path=f'/tmp/aar_{sid}.png')

        pg.click('main [data-replay] >> nth=0'); pg.clock.run_for(300)
        ok(f'[{sid}] replay opens for this scenario', pg.get_attribute('#replayOverlay', 'data-scenario') == sid and E['name'] in pg.inner_text('#replayOverlay'))
        evs = norm(pg.inner_text('#replayEvents'))
        found = [e for e in E['events'] if e.lower() in evs.lower()]
        ok(f'[{sid}] replay contains scenario-specific events', len(found) >= 2, found)
        ok(f'[{sid}] replay reconstructs the scene', pg.locator('#replayStage .sceneSvg').count() == 1)
        n_ev = pg.locator('#replayEvents button').count()
        best = 0; sens = ''
        for i in range(0, n_ev):
            pg.evaluate(f"(()=>{{const r=document.getElementById('replayRange');r.value={i};r.dispatchEvent(new Event('input'))}})()")
            best = max(best, pg.locator('#replayContacts .rpMark').count()); sens += pg.inner_text('#replaySensors')
        ok(f'[{sid}] replay shows contacts', best >= 1, best)
        if sid == 'swarm': ok('[swarm] replay shows many contacts', best >= 6, best)
        if sid == 'degraded': ok('[degraded] replay shows sensor failures', 'OFF' in sens, '')
        pg.click('#replayPlay'); pg.clock.run_for(2000); pg.click('#replayPlay')
        pg.click('#closeReplay'); pg.clock.run_for(100)
        ok(f'[{sid}] replay closes', pg.locator('#replayOverlay').count() == 0)

    ok('all six scenarios have distinct theme/contacts/sensor/weights signatures', len({json.dumps(v) for v in SIG.values()}) == 6)
    ok('six visually distinct 3D views (pixel signatures differ)', len({tuple(v) for v in PIXELS.values()}) == 6 and all(sum(abs(a - b) for a, b in zip(PIXELS[x], PIXELS[y])) > 18 for x in PIXELS for y in PIXELS if x < y), str(PIXELS))
    ok('themes are all different', len({v[0] for v in SIG.values()}) == 6, [v[0] for v in SIG.values()])

    for name in ['readiness', 'instructor', 'command', 'judge', 'analytics', 'training', 'analytics', 'scenarios', 'home']:
        pg.click(f'nav [data-nav="{name}"]'); pg.clock.run_for(300)
        ok('post-session page renders: ' + name, pg.locator('main').count() == 1 and pg.inner_text('main').strip() != '')
    pg.click('nav [data-nav="scenarios"]'); pg.clock.run_for(100)
    pg.click('[data-action="generate"]'); pg.clock.run_for(200)
    ok('Generate with AI produces a real scenario mission', pg.locator('[data-start-generated]').count() == 1, norm(pg.inner_text('.demoBanner'))[:100])
    pg.click('[data-start-generated]'); pg.clock.run_for(300)
    ok('generated mission launches Training', pg.locator('.trainingPage').count() == 1, pg.get_attribute('.trainingPage', 'data-scenario'))
    pg.click('[data-end-session]'); pg.clock.run_for(300)
    pg.click('[data-recommended] >> nth=0'); pg.clock.run_for(300)
    ok('recommended training launches Training', pg.locator('.trainingPage').count() == 1, pg.get_attribute('.trainingPage', 'data-scenario'))
    pg.click('nav [data-nav="scenarios"]'); pg.clock.run_for(100)
    for f in ['Swarm', 'Night', 'Single Drone']:
        pg.click(f'[data-filter="{f}"]'); pg.clock.run_for(100)
        ok(f'scenario filter "{f}"', pg.locator('.scenarioCard').count() >= 1, pg.locator('.scenarioCard').count())
    b.close()

print('\nCONSOLE ERRORS/WARNINGS:', errs)
print('HTTP FAILURES:', bad)
ok('no console errors or warnings', not errs, errs[:3])
ok('no failed requests', not bad, bad[:3])
fails = [r for r in R if not r[1]]
print(f'\n{len(R)-len(fails)}/{len(R)} checks passed')
sys.exit(1 if fails else 0)
