# Optional end-to-end test (needs: pip install playwright && playwright install chromium; server running on :5173)
from playwright.sync_api import sync_playwright
import json
errs=[];bad=[]
R=[]
def ok(name,cond,extra=''): R.append((name,bool(cond),extra)); print(('PASS' if cond else 'FAIL'),name,extra)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':900}); pg=ctx.new_page()
    pg.on('console',lambda m: errs.append((m.type,m.text)) if m.type in('error','warning') else None)
    pg.on('pageerror',lambda e: errs.append(('pageerror',str(e))))
    pg.on('response',lambda r: bad.append((r.status,r.url)) if r.status>=400 else None)
    pg.on('requestfailed',lambda r: bad.append(('failed',r.url)))
    pg.goto('http://127.0.0.1:5173'); pg.wait_for_timeout(600)
    for name in ['features','scenarios','readiness','instructor','command','judge','about','analytics','home']:
        pg.click(f'nav [data-nav="{name}"]'); pg.wait_for_timeout(150)
        ok('page '+name, pg.locator('main').count()==1 and pg.inner_text('main').strip()!='')
    pg.click('nav [data-nav="training"]'); pg.wait_for_timeout(800)
    ok('training renders',pg.locator('.trainingPage').count()==1)
    ok('layout: decision row is sibling of battlefield (inside trainingMain)', pg.evaluate("document.querySelector('.decision').parentElement.classList.contains('trainingMain')"))
    ok('layout: trainingBottom inside trainingMain', pg.evaluate("document.querySelector('.trainingBottom').parentElement.classList.contains('trainingMain')"))
    ok('layout: contact markers inside battlefield', pg.evaluate("document.querySelectorAll('#battlefield .contactMark').length")==2)
    ok('layout: miniRadar has 6 children', pg.evaluate("document.querySelector('.miniRadar').children.length")==6)
    pg.screenshot(path='/tmp/train_fixed.png')
    # timer
    t0=pg.inner_text('#tClock'); pg.wait_for_timeout(2300); t1=pg.inner_text('#tClock'); ok('timer advances',t0!=t1,f'{t0}->{t1}')
    # direct click on decisions with REAL clicks (no detaching)
    sc=lambda: int(pg.inner_text('#telemetry').split('SCORE')[1].split('/')[0].strip().split()[-1]) if 'SCORE' in pg.inner_text('#telemetry') else None
    s0=sc()
    pg.click('[data-decision="Classify"]'); pg.wait_for_timeout(150); s1=sc()
    pg.click('[data-decision="Track"]'); pg.wait_for_timeout(150); s2=sc()
    pg.click('[data-decision="Ignore"]'); pg.wait_for_timeout(150); s3=sc()
    pg.click('[data-decision="Monitor"]'); pg.wait_for_timeout(150)
    pg.click('[data-decision="Escalate"]'); pg.wait_for_timeout(150); s5=sc()
    ok('score changes with decisions',(s0,s1,s2,s3,s5)==(86,88,90,88,89),str((s0,s1,s2,s3,s5)))
    ev=pg.inner_text('.contact')
    ok('decision events recorded','Escalate decision recorded' in ev and 'Monitor' in ev)
    ok('adaptive pressure displayed',pg.inner_text('#adaptive').count('%')>=1,pg.inner_text('#adaptive').split('\n')[1])
    # contact selection
    pg.click('[data-contact="CONTACT 01"]'); pg.wait_for_timeout(100)
    ok('contact select updates detail',pg.inner_text('.contact h3')=='CONTACT 01')
    # contact spawn after 10s
    pg.wait_for_timeout(7000)
    ok('new contact spawns by ~10s',pg.locator('.contactMark').count()>=3,str(pg.locator('.contactMark').count()))
    # mark as drone
    pg.click('[data-mark-drone]'); pg.wait_for_timeout(100); ok('mark drone',pg.inner_text('.contact').count('Classified')>=1)
    # joystick
    cur=lambda: pg.evaluate("[parseFloat(document.getElementById('sensorCursor').style.left),parseFloat(document.getElementById('sensorCursor').style.top)]")
    pg.click('[data-center]'); pg.wait_for_timeout(100); ok('center resets',cur()==[50,50],str(cur()))
    j=pg.locator('#joystick').bounding_box(); cx=j['x']+j['width']/2; cy=j['y']+j['height']/2
    def drag(dx,dy,name,test):
        pg.click('[data-center]'); pg.wait_for_timeout(80)
        pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx+dx,cy+dy,steps=4); pg.wait_for_timeout(1100)  # held across a timer tick
        c=cur(); th=pg.evaluate("document.getElementById('joystickThumb').style.transform")
        pg.mouse.up(); pg.wait_for_timeout(150)
        th2=pg.evaluate("document.getElementById('joystickThumb').style.transform")
        c2=cur(); pg.wait_for_timeout(300); c3=cur()
        ok('joystick '+name,test(c) and c2==c3 and '+ 0px' in th2,f'cursor={c} thumb_after_release={th2}')
    drag(0,-40,'up',lambda c:c[1]<45 and abs(c[0]-50)<2)
    drag(0,40,'down',lambda c:c[1]>55 and abs(c[0]-50)<2)
    drag(-40,0,'left',lambda c:c[0]<45)
    drag(40,0,'right',lambda c:c[0]>55)
    drag(35,-35,'diagonal up-right',lambda c:c[0]>52 and c[1]<48)
    # proportional: half deflection moves slower than full
    pg.click('[data-center]'); pg.wait_for_timeout(80); pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx+8,cy,steps=3); pg.wait_for_timeout(1000); half=cur()[0]; pg.mouse.up()
    pg.click('[data-center]'); pg.wait_for_timeout(80); pg.mouse.move(cx,cy); pg.mouse.down(); pg.mouse.move(cx+40,cy,steps=3); pg.wait_for_timeout(1000); full=cur()[0]; pg.mouse.up()
    ok('joystick is proportional (half < full)',50<half<full,f'half={half} full={full}')
    # touch-style pointer events
    pg.click('[data-center]'); pg.wait_for_timeout(80)
    pg.evaluate("(()=>{const j=document.getElementById('joystick'),r=j.getBoundingClientRect();const o={bubbles:true,pointerId:7,pointerType:'touch',clientX:r.left+r.width/2-20,clientY:r.top+r.height/2};j.dispatchEvent(new PointerEvent('pointerdown',o))})()")
    pg.wait_for_timeout(700)
    pg.evaluate("document.getElementById('joystick').dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:7,pointerType:'touch'}))")
    ok('touch pointer drag left',cur()[0]<45,str(cur()))
    # keyboard
    pg.click('[data-center]'); pg.evaluate("document.activeElement&&document.activeElement.blur()")
    for key,test,n in [('w',lambda c:c[1]<50,'W'),('s',lambda c:c[1]>50,'S'),('a',lambda c:c[0]<50,'A'),('d',lambda c:c[0]>50,'D'),('ArrowUp',lambda c:c[1]<50,'ArrowUp'),('ArrowDown',lambda c:c[1]>50,'ArrowDown'),('ArrowLeft',lambda c:c[0]<50,'ArrowLeft'),('ArrowRight',lambda c:c[0]>50,'ArrowRight')]:
        pg.click('[data-center]'); pg.wait_for_timeout(60)
        pg.keyboard.down(key); pg.wait_for_timeout(500); pg.keyboard.up(key); pg.wait_for_timeout(100)
        ok('keyboard '+n,test(cur()),str(cur()))
    # diagonal keyboard
    pg.click('[data-center]'); pg.keyboard.down('w'); pg.keyboard.down('d'); pg.wait_for_timeout(500); pg.keyboard.up('w'); pg.keyboard.up('d'); c=cur(); ok('keyboard diagonal W+D',c[0]>50 and c[1]<50,str(c))
    # replay from training
    pg.click('[data-replay]'); pg.wait_for_timeout(300)
    ok('replay opens',pg.locator('#replayOverlay').count()==1)
    n=pg.locator('[data-replay-event]').count(); ok('replay lists events',n>=8,str(n))
    pg.click('[data-replay-event] >> nth=3'); ok('replay event selectable',pg.inner_text('#replayIndex')=='4')
    pg.click('#replayPlay'); pg.wait_for_timeout(1900); ok('replay plays',int(pg.inner_text('#replayIndex'))>=5,pg.inner_text('#replayIndex'))
    # arrow keys must NOT move cursor while replay open
    before=cur(); pg.keyboard.press('ArrowLeft'); pg.wait_for_timeout(200); ok('keys ignored while replay open',cur()==before)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); ok('Esc closes replay',pg.locator('#replayOverlay').count()==0)
    ok('training intact after replay',pg.locator('.trainingPage').count()==1 and pg.locator('#tClock').count()==1)
    # end session -> AAR
    pg.click('[data-end-session]'); pg.wait_for_timeout(300)
    ok('AAR opens',pg.locator('.aarTop').count()==1)
    ok('AAR score ring',pg.locator('.scoreRing b').count()==1,pg.inner_text('.scoreRing b'))
    pg.click('.aarTop [data-replay]'); pg.wait_for_timeout(200); ok('AAR replay opens w/ events',pg.locator('[data-replay-event]').count()>=8); pg.click('#closeReplay')
    pg.click('.replay [data-replay]'); pg.wait_for_timeout(200); ok('AAR replay tile works',pg.locator('#replayOverlay').count()==1); pg.keyboard.press('Escape')
    # readiness/history updated
    pg.click('nav [data-nav="readiness"]'); pg.wait_for_timeout(150); ok('readiness sessions=4',pg.inner_text('.readinessStats').split('\n')[0]=='4',pg.inner_text('.readinessStats').replace('\n',' '))
    # navigation stress
    for seq in ['home','training','home','training','scenarios','training','analytics','training','instructor','training','command','training','judge','training','about','training','readiness','training','features','training']:
        pg.click(f'nav [data-nav="{seq}"]'); pg.wait_for_timeout(120)
        if seq=='training': 
            if pg.locator('.trainingPage').count()!=1: ok('nav stress',False,seq); break
    else: ok('nav stress (20 hops incl. 10x Training)',True)
    # timer not doubled after many restarts
    pg.click('nav [data-nav="scenarios"]'); pg.click('[data-start-scenario] >> nth=0'); pg.wait_for_timeout(200)
    pg.click('nav [data-nav="scenarios"]'); pg.click('[data-start-scenario] >> nth=3'); pg.wait_for_timeout(200)
    pg.click('nav [data-nav="home"]'); pg.click('nav [data-nav="training"]')
    a=pg.inner_text('#tClock'); pg.wait_for_timeout(4100); bb=pg.inner_text('#tClock')
    def sec(x): m,s=x.split(':')[1:]; return int(m)*60+int(s)
    ok('single timer (no leak): ~4s in 4.1s',3<=sec(bb)-sec(a)<=5,f'{a}->{bb}')
    ok('mission fields populated for scenario start',all(x in pg.inner_text('.mission') for x in ['Swarm','Difficulty']) , pg.inner_text('.mission').replace('\n',' ')[:160])
    # reload while on training
    pg.reload(); pg.wait_for_timeout(500); ok('reload on training ok',pg.locator('main').count()==1)
    pg.click('nav [data-nav="training"]'); pg.wait_for_timeout(300); ok('training after reload',pg.locator('.trainingPage').count()==1)
    # replay with no events
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(400)
    pg.click('nav [data-nav="analytics"]'); pg.click('.aarTop [data-replay]'); pg.wait_for_timeout(200)
    ok('replay w/o events shows message','No replay events available.' in pg.inner_text('#replayOverlay'))
    pg.click('#closeReplay')
    b.close()
print('CONSOLE:',json.dumps(errs)); print('BAD REQUESTS:',bad)
print('SUMMARY',sum(1 for r in R if r[1]),'/',len(R))
