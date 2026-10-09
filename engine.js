/* AEROSHIELD Training Engine — consumes scenario configurations from scenarios.js.
   Pure simulation logic (no DOM). Everything is a SYNTHETIC training construct: contacts are abstract points,
   "decisions" are training judgements scored for the after-action review. No real-world targeting or weapon control. */
(function (g) {
  'use strict';
  const NS = g.AeroShield = g.AeroShield || {};
  const { SENSORS, DIFFICULTY, METRICS, TYPES, SCENARIOS, ORDER, rng32 } = NS;

  const AR = 2.5; // battlefield aspect (viewBox 1000x400) so that range is physically isotropic
  const SITE = { x: 50, y: 94 };
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const pad2 = n => String(n).padStart(2, '0');
  const PRIOR = 55, PRIOR_W = 1.2, DET_THRESHOLD = .38;
  const SENSOR_W = { radar: .3, eoir: .35, rf: .2, acoustic: .15 };

  function rr(sim, range) { return range[0] + sim.rand() * (range[1] - range[0]); }
  function ri(sim, lo, hi) { return lo + Math.floor(sim.rand() * (hi - lo + 1)); }
  function pickWeighted(sim, weights) {
    const keys = Object.keys(weights); let tot = 0; keys.forEach(k => tot += weights[k]);
    let r = sim.rand() * tot; for (const k of keys) { r -= weights[k]; if (r <= 0) return k; } return keys[keys.length - 1];
  }
  function tc(t) { return `00:${pad2(Math.floor(t / 60))}:${pad2(Math.floor(t % 60))}`; }

  // ---------------- geometry ----------------
  function rangeKm(sim, c) { const P = sim.sensorPos || SITE; return Math.max(0.05, Math.hypot((c.x - P.x) * AR, P.y - c.y) / SITE.y * sim.cfg.fieldKm); }
  function bearingDeg(c, sim) { const P = (sim && sim.sensorPos) || SITE; const dx = (c.x - P.x) * AR, dy = P.y - c.y; return Math.round((Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360); }
  function distPct(a, b) { return Math.hypot((a.x - b.x) * AR, a.y - b.y); }

  // ---------------- creation ----------------
  function createSim(id, opts) {
    opts = opts || {};
    const cfg = SCENARIOS[id] || SCENARIOS.urban;
    const diffName = DIFFICULTY[opts.difficulty] ? opts.difficulty : cfg.difficulty;
    const diff = DIFFICULTY[diffName];
    const seed = opts.seed != null ? opts.seed >>> 0 : (Math.random() * 4294967295) >>> 0;
    const sim = {
      id: cfg.id, cfg, diff, diffName, seed, rand: rng32(seed),
      running: true, complete: false, elapsed: 0, selected: null, cursorX: 50, cursorY: 50, decisions: 0,
      contacts: [], all: [], nextId: 1, nextGroup: 1, mods: [], eventLog: [], events: [], frames: [], schedule: [],
      sensors: {}, sensorPos: { x: SITE.x, y: SITE.y }, mode3d: false, envPhase: 0, env: { time: cfg.startTime || cfg.time, weather: cfg.startWeather || cfg.weather }, envNote: '', tab: cfg.defaultTab || 'EO/IR',
      lastEdge: 0, nextSpawnAt: 0, adapt: 1, thermalFocus: null, conflictFocus: null,
      M: {}, counters: { classCorrect: 0, classWrong: 0, premature: 0, falseEsc: 0, missed: 0, reacquired: 0, reacqFailed: 0, earlyDetect: 0, fusionDecisions: 0, goodPriority: 0, outageDecisions: 0, ignoredThreat: 0, correctDecisions: 0, arrivals: 0, arrivalsUnhandled: 0, eventsTriggered: 0, spawned: 0, droneSpawned: 0, clutterSpawned: 0 },
      mission: null, stats: {}
    };
    Object.keys(METRICS).forEach(k => sim.M[k] = { sum: 0, n: 0 });
    // sensors
    SENSORS.forEach(s => {
      const p = cfg.sensorProfile[s], dg = (cfg.sensorDegradation || {})[s] || {};
      sim.sensors[s] = {
        key: s, baseConf: p.conf, baseNoise: clamp(p.noise + (dg.noiseAdd || 0) + (diff.level - 1) * .03, 0, .9), range: p.range,
        pDetect: clamp(p.pDetect * diff.sensorRel, 0, .98), label: p.label, intermittent: p.intermittent || 0, baseOffline: p.baseOffline || 0, blockP: p.blockP || 0,
        available: true, status: p.label, shownConf: p.conf, eff: { conf: p.conf, noise: p.noise, pDetect: p.pDetect, delayFar: false }, detections: 0, mod: null
      };
    });
    sim.mission = {
      id: cfg.id, name: cfg.name, env: cfg.environment, time: cfg.startTime || cfg.time, weather: cfg.startWeather || cfg.weather, threats: cfg.threatShort, difficulty: diffName,
      terrain: cfg.terrain, visibility: cfg.visibility, objective: cfg.objectiveText, briefing: cfg.briefing
    };
    // initial contacts (difficulty scales the count)
    const ic = cfg.contactCount.initial, base = ri(sim, ic[0], ic[1]);
    const rel = diff.countMul / DIFFICULTY[cfg.difficulty].countMul;
    const n = clamp(Math.round(base * rel), ic[0], cfg.contactCount.max);
    let groupId = null, groupLeft = 0;
    for (let i = 0; i < n; i++) {
      let key = pickWeighted(sim, cfg.contactTypes);
      if (i === 0 && TYPES[key].truth !== 'drone') key = Object.keys(cfg.contactTypes).find(k => TYPES[k].truth === 'drone');
      if (cfg.spawnPattern.flock && groupLeft <= 0) { groupId = sim.nextGroup++; groupLeft = ri(sim, 3, 5); }
      groupLeft--;
      makeContact(sim, key, { initial: true, group: cfg.spawnPattern.flock ? groupId : null });
    }
    // event schedule (event frequency scales with difficulty)
    sim.schedule = cfg.eventPool.map(ev => {
      const raw = ev.at ? rr(sim, ev.at) : ev.startAt;
      return { ev, at: Math.max(6, Math.round(raw * diff.eventMul)), done: false };
    }).sort((a, b) => a.at - b.at);
    sim.nextSpawnAt = Math.round(cfg.spawnPattern.startAfter * diff.eventMul);
    sim.selected = sim.contacts[0] ? sim.contacts[0].n : null;
    logEvent(sim, 'Mission started: ' + cfg.name, 'system');
    logEvent(sim, 'Sensor sweep initialised (' + diffName + ' profile)', 'system');
    if (sim.contacts[0]) logEvent(sim, sim.contacts[0].n + ' entered sensor coverage', 'event');
    updateSensors(sim); updateEvidence(sim); updateConf(sim); updateAssessment(sim); recompute(sim); captureFrame(sim);
    return sim;
  }

  function entryPoint(sim, mode) {
    const cfg = sim.cfg;
    if (mode === 'mixed') mode = sim.rand() < .5 ? 'edge' : 'interior';
    if (mode === 'interior') return { x: 14 + sim.rand() * 72, y: 14 + sim.rand() * 46 };
    let side = mode === 'edgeOpposite' ? 1 - sim.lastEdge : (sim.rand() < .5 ? 0 : 1);
    if (mode === 'edge' && sim.rand() < .3) side = 2;
    sim.lastEdge = side === 2 ? sim.lastEdge : side;
    if (side === 2) return { x: 20 + sim.rand() * 60, y: 2 + sim.rand() * 4 };
    return { x: side === 0 ? 3 + sim.rand() * 4 : 93 + sim.rand() * 4, y: 6 + sim.rand() * 44 };
  }

  function makeContact(sim, key, o) {
    o = o || {}; const cfg = sim.cfg, T = TYPES[key], id = sim.nextId++;
    let pos;
    if (o.x != null) pos = { x: o.x, y: o.y };
    else if (o.initial) {
      if (cfg.id === 'border') pos = { x: 8 + sim.rand() * 84, y: 6 + sim.rand() * 26 };
      else if (cfg.id === 'swarm') pos = { x: 12 + sim.rand() * 76, y: 8 + sim.rand() * 46 };
      else pos = entryPoint(sim, 'interior');
    } else pos = entryPoint(sim, o.entry || cfg.spawnPattern.entry);
    const pattern = cfg.movementPattern[key] || 'transit';
    const kmh = Math.round(rr(sim, T.kmh)), speed = kmh * cfg.moveScale * sim.diff.speedMul * (pattern === 'ghost' ? 0 : 1);
    const c = {
      id, n: 'CONTACT ' + pad2(id), type: key, label: T.label, truth: T.truth, size: T.size, hiddenType: !!T.hidden,
      x: pos.x, y: pos.y, alt: Math.round(rr(sim, T.alt)), kmh, speed, heading: 0, pattern, phase: sim.rand() * 6.28, group: o.group || null,
      born: sim.elapsed, age: 0, state: 'active', conf: 0, ev: { radar: 0, eoir: 0, rf: 0, acoustic: 0 }, det: { radar: false, eoir: false, rf: false, acoustic: false },
      nDet: 0, vis: Object.assign({}, T.vis), status: o.initial ? 'Detected' : 'New Contact', classification: null, tracked: false, handled: false, attended: false,
      lastAttend: -999, detAt: null, decidableAt: null, bonus: 0, cursorOn: 0, blockUntil: 0, thermalUntil: 0, conflictUntil: 0, mergeUntil: 0, mergeWith: null,
      occUntil: 0, occCause: null, lastKnown: null, needReacq: false, reacqSince: 0, reappearElsewhere: false, fpEvent: !!o.fpEvent, life: o.life || 0, dirty: 0,
      trackSamples: 0, trackSum: 0, rank: 0, threat: 0, wpt: null, decisionsOn: 0, outcome: null
    };
    // heading: toward the sensor site (transit-style) with scenario-dependent offset; flock members share a group heading
    const toSite = Math.atan2((SITE.x + (sim.rand() - .5) * 40 - c.x) * AR, -(SITE.y - c.y - (sim.rand() - .5) * 30));
    c.heading = toSite;
    if (c.group) {
      sim.groups = sim.groups || {};
      const gp = sim.groups[c.group] || (sim.groups[c.group] = { heading: toSite, wpt: randWpt(sim), speed: speed || 1 });
      c.heading = gp.heading + (sim.rand() - .5) * .3; c.speed = gp.speed * (.85 + sim.rand() * .3); c.wpt = gp.wpt;
    }
    if (pattern === 'ghost') { c.speed = 0; }
    if (c.pattern === 'creep') c.speed *= .6;
    if (c.pattern === 'drift') c.speed *= .5;
    sim.contacts.push(c); sim.all.push(c);
    sim.counters.spawned++; if (c.truth === 'drone') sim.counters.droneSpawned++; else sim.counters.clutterSpawned++;
    return c;
  }
  function randWpt(sim) { return { x: 18 + sim.rand() * 64, y: 14 + sim.rand() * 40 }; }

  // ---------------- logging ----------------
  function logEvent(sim, text, kind) { sim.events.push([tc(sim.elapsed), text, kind || 'event']); }

  // ---------------- sensors ----------------
  function updateSensors(sim) {
    const t = sim.elapsed;
    sim.mods = sim.mods.filter(m => m.until > t);
    SENSORS.forEach(k => {
      const S = sim.sensors[k];
      S.available = true; S.eff = { conf: S.baseConf, noise: S.baseNoise, pDetect: S.pDetect, delayFar: false }; S.status = S.label; S.mod = null;
      if (S.baseOffline && t < S.baseOffline) { S.available = false; S.status = 'OFFLINE'; S.mod = 'blackout'; }
      sim.mods.forEach(m => {
        if (m.sensor !== k) return;
        if (m.mod === 'outage') { S.available = false; S.status = 'OFFLINE'; S.mod = 'outage'; }
        else if (m.mod === 'drop') { S.eff.conf *= m.confMul || .6; S.eff.pDetect *= m.confMul || .6; S.eff.noise = clamp(S.eff.noise + (m.noiseAdd || .15), 0, .9); if (S.available) { S.status = k === 'radar' ? 'LOW CONFIDENCE' : 'DEGRADED'; S.mod = 'drop'; } }
        else if (m.mod === 'overload') { S.eff.pDetect *= .5; S.eff.noise = clamp(S.eff.noise + .3, 0, .9); S.eff.conf *= .7; if (S.available) { S.status = 'OVERLOAD'; S.mod = 'overload'; } }
        else if (m.mod === 'delay') { S.eff.delayFar = true; S.status = 'CONFIRM DELAY'; S.mod = 'delay'; }
        else if (m.mod === 'env') { S.eff.pDetect *= m.pMul || .85; S.eff.noise = clamp(S.eff.noise + (m.noiseAdd || .1), 0, .9); }
      });
      if (S.available && S.intermittent && sim.rand() < S.intermittent) { S.available = false; S.dropout = true; } else S.dropout = false;
      const target = S.available ? clamp(S.eff.conf + (sim.rand() - .5) * S.eff.noise * 36, 4, 99) : 0;
      S.shownConf = Math.round(S.shownConf + (target - S.shownConf) * .6);
      if (!S.available && !S.dropout) S.shownConf = 0;
    });
  }

  // ---------------- per-contact evidence ----------------
  function updateEvidence(sim) {
    const t = sim.elapsed, cfg = sim.cfg;
    const cursorBoost = cfg.theme === 'night' ? .38 : .15;
    SENSORS.forEach(k => sim.sensors[k].detections = 0);
    let radarLoad = 0;
    sim.contacts.forEach(c => {
      if (c.state !== 'active') { SENSORS.forEach(k => { c.ev[k] = 0; c.det[k] = false; }); c.nDet = 0; c.target = 0; return; }
      const rng = rangeKm(sim, c);
      const nearCursor = sim.mode3d ? (c.aimOff != null && c.aimOff < 0.22) : Math.hypot((c.x - sim.cursorX) * AR, c.y - sim.cursorY) < 20;
      const blocked = sim.mode3d && c.los === 0;
      SENSORS.forEach(k => {
        const S = sim.sensors[k]; let ev = 0;
        if (S.available && rng <= S.range) {
          const falloff = 1 - .55 * (rng / S.range);
          let p = S.eff.pDetect * (c.vis[k] == null ? 1 : c.vis[k]) * falloff;
          if (blocked) p *= (k === 'eoir' ? .1 : k === 'radar' ? .5 : k === 'acoustic' ? .7 : .8);
          if (k === 'eoir') {
            if (t < c.blockUntil) p *= .15;
            if (S.eff.delayFar && rng > S.range * .4) p = 0;
            if (nearCursor) p += cursorBoost;
            if (t < c.thermalUntil) p = Math.max(p, .86);
          }
          if (c.fpEvent) p = k === 'radar' ? .85 : 0;
          if (t < c.conflictUntil && k === 'rf') p = c.truth === 'drone' ? .85 : .0;
          if (t < c.conflictUntil && k === 'eoir') p = c.truth === 'drone' ? .05 : .8;
          ev = clamp(p + (sim.rand() - .5) * S.eff.noise * .8, 0, 1);
          if (p <= 0.001 && !c.fpEvent) ev = 0;
        }
        c.ev[k] = c.ev[k] * .35 + ev * .65;
        c.det[k] = c.ev[k] > DET_THRESHOLD;
        if (c.det[k]) S.detections++;
      });
      let nd = 0; SENSORS.forEach(k => { if (c.det[k]) nd++; });
      c.nDet = t < c.conflictUntil ? Math.min(nd, 1) : nd;
      if (c.det.radar) radarLoad++;
      let miss = 1; SENSORS.forEach(k => { miss *= 1 - clamp(c.ev[k], 0, 1) * .88; });
      let target = (1 - miss) * 100 * sim.diff.confGain;
      if (t < c.conflictUntil) target *= .62;
      if (t < c.mergeUntil) target *= .8;
      c.target = target;
    });
    sim.radarLoad = radarLoad;
  }

  function updateConf(sim) {
    sim.contacts.forEach(c => {
      if (c.state !== 'active') { c.conf = Math.max(0, c.conf - 6); return; }
      c.bonus = Math.max(0, c.bonus - .25);
      const tgt = clamp(c.target + (c.nDet >= 1 ? c.bonus : 0), 0, 99); // attention can help, but never creates evidence
      c.conf = c.conf + (tgt - c.conf) * (tgt > c.conf ? .35 : .25);
      if (c.nDet === 0 && c.conf < 6) c.conf = Math.max(0, c.conf - 1);
    });
  }

  // ---------------- movement ----------------
  function stepContacts(sim) {
    const cfg = sim.cfg, t = sim.elapsed;
    sim.contacts.forEach(c => {
      c.age = t - c.born;
      if (c.state === 'occluded') {
        // contact keeps moving while hidden (the trainee only sees the last known position)
        advance(sim, c, true);
        if (t >= c.occUntil) reappear(sim, c);
        return;
      }
      if (c.mergeWith && t < c.mergeUntil) {
        const o = sim.all.find(x => x.id === c.mergeWith);
        if (o && o.state === 'active') { c.x += (o.x - c.x) * .45; c.y += (o.y - c.y) * .45; }
      } else if (c.mergeWith) { c.mergeWith = null; c.x += (sim.rand() - .5) * 7; c.y += (sim.rand() - .5) * 5; logEvent(sim, c.n + ' separates from merged track', 'event'); }
      advance(sim, c, false);
      if (c.life && t - c.born >= c.life) { c.state = 'gone'; c.outcome = 'expired'; settleGone(sim, c); }
      if (c.leaveAt && t >= c.leaveAt) { c.state = 'gone'; c.outcome = 'handed-off'; logEvent(sim, c.n + ' handed off to simulated command and removed from the picture', 'event'); settleGone(sim, c); }
    });
  }
  function advance(sim, c, hidden) {
    const cfg = sim.cfg, t = sim.elapsed;
    let sp = c.speed, h = c.heading;
    switch (c.pattern) {
      case 'weave': h = c.heading + Math.sin(c.age / 5 + c.phase) * .8; break;
      case 'creep': sp *= ((c.age + c.phase * 3) % 14 < 5) ? .25 : 1; c.heading += (sim.rand() - .5) * .5; h = c.heading; break;
      case 'drift': c.heading += (sim.rand() - .5) * .9; h = c.heading; break;
      case 'erratic': c.heading += (sim.rand() - .5) * 1.1; h = c.heading; break;
      case 'ghost': c.x += (sim.rand() - .5) * .8; c.y += (sim.rand() - .5) * .8; sp = 0; break;
      case 'flock': {
        const gp = sim.groups && sim.groups[c.group];
        const w = (gp && gp.wpt) || c.wpt || randWpt(sim);
        const want = Math.atan2((w.x - c.x) * AR, -(w.y - c.y));
        let d = want - c.heading; d = Math.atan2(Math.sin(d), Math.cos(d)); c.heading += clamp(d, -.35, .35) + (sim.rand() - .5) * .12; h = c.heading;
        if (Math.hypot((w.x - c.x) * AR, w.y - c.y) < 9 && gp) gp.wpt = randWpt(sim);
        break;
      }
      default: c.heading += (sim.rand() - .5) * .08; h = c.heading;
    }
    c.x += Math.sin(h) * sp / AR; c.y -= Math.cos(h) * sp;
    if (c.pattern !== 'transit' && c.pattern !== 'weave') { // interior movers are kept inside the field
      if (c.x < 4 || c.x > 96) c.heading = Math.PI * 2 - c.heading, c.x = clamp(c.x, 4, 96);
      if (c.y < 5 || c.y > 88) c.heading = Math.PI - c.heading, c.y = clamp(c.y, 5, 88);
    }
    if (hidden) return;
    // arrival / exit (transit-style movers)
    const dSite = Math.hypot((c.x - SITE.x) * AR, SITE.y - c.y);
    if ((c.pattern === 'transit' || c.pattern === 'weave') && c.age > 4) {
      if (dSite < 11) { arrive(sim, c); return; }
      if (c.x < -3 || c.x > 103 || c.y < -3 || c.y > 100) { c.state = 'gone'; c.outcome = 'exited'; logEvent(sim, c.n + ' left the observation area', 'event'); settleGone(sim, c); }
    }
  }
  function arrive(sim, c) {
    c.state = 'gone'; c.outcome = 'arrived';
    if (c.truth === 'drone') {
      sim.counters.arrivals++;
      if (!c.handled) { sim.counters.arrivalsUnhandled++; addPts(sim, 'response', 0); addPts(sim, 'awareness', 10); if (!c.attended) { c.missedFlag = true; sim.counters.missed++; addPts(sim, 'detection', 0); } logEvent(sim, c.n + ' reached the protected area unresolved (simulated)', 'sensor'); }
      else logEvent(sim, c.n + ' reached the protected area (already assessed)', 'event');
    } else { logEvent(sim, c.n + ' dissipated near the perimeter', 'event'); }
    settleGone(sim, c);
  }
  function settleGone(sim, c) {
    if (c.truth !== 'drone' && !c.handled && !c.fpScored) { c.fpScored = true; addPts(sim, 'falsePositive', 80); }
    if (c.truth === 'drone' && c.detAt != null && !c.attended && !c.missedFlag) { c.missedFlag = true; sim.counters.missed++; addPts(sim, 'detection', 0); }
  }

  function startOcclusion(sim, c, dur, cause, elsewhere) {
    if (!c || c.state !== 'active') return false;
    c.state = 'occluded'; c.occUntil = sim.elapsed + dur; c.occCause = cause; c.lastKnown = { x: c.x, y: c.y }; c.reappearElsewhere = !!elsewhere;
    c.wasTracked = c.tracked || c.attended; c.status = 'Track Lost';
    return true;
  }
  function reappear(sim, c) {
    c.state = 'active'; c.occUntil = 0;
    if (c.reappearElsewhere) { const p = entryPoint(sim, sim.rand() < .5 ? 'edge' : 'edgeOpposite'); c.x = p.x; c.y = p.y; c.heading = Math.atan2((SITE.x - c.x) * AR, -(SITE.y - c.y)); c.reappearElsewhere = false; }
    c.status = 'Reacquired'; c.lastKnown = null; c.needReacq = !!c.wasTracked; c.reacqSince = sim.elapsed; c.blockUntil = 0;
    logEvent(sim, c.n + ' reappears' + (c.occCause ? ' (after ' + c.occCause + ' masking)' : ''), 'event');
  }

  // ---------------- spawning ----------------
  function activeCount(sim) { return sim.contacts.filter(c => c.state !== 'gone').length; }
  // Scripted director events take priority over the periodic spawner: if the picture is full, retire an already-handled
  // (or oldest dismissed/clutter) contact so the scripted contact can enter. Never evicts an unhandled real contact.
  function makeRoom(sim) {
    const live = sim.contacts.filter(c => c.state !== 'gone');
    const victim = live.filter(c => c.handled).sort((a, b) => a.born - b.born)[0] || live.filter(c => c.truth !== 'drone').sort((a, b) => a.born - b.born)[0];
    if (!victim) return false;
    victim.state = 'gone'; victim.outcome = 'exited'; settleGone(sim, victim); return true;
  }
  function spawnGroup(sim, size, entry, kinds, force) {
    const cfg = sim.cfg, sp = cfg.spawnPattern; let made = [];
    const grp = (sp.flock && size > 1) ? sim.nextGroup++ : null;
    for (let i = 0; i < size; i++) {
      if (activeCount(sim) >= cfg.contactCount.max && !(force && makeRoom(sim))) break;
      let key = kinds ? kinds[ri(sim, 0, kinds.length - 1)] : pickWeighted(sim, cfg.contactTypes);
      if (i === 0 && !kinds && TYPES[key].truth !== 'drone' && sim.rand() < .55) key = Object.keys(cfg.contactTypes).find(k => TYPES[k].truth === 'drone');
      const c = makeContact(sim, key, { entry, group: grp, x: made[0] ? made[0].x + (sim.rand() - .5) * 8 : undefined, y: made[0] ? made[0].y + (sim.rand() - .5) * 6 : undefined });
      if (made[0] && grp) { c.heading = made[0].heading + (sim.rand() - .5) * .2; }
      made.push(c);
    }
    return made;
  }
  function updateSpawns(sim) {
    const cfg = sim.cfg, sp = cfg.spawnPattern, t = sim.elapsed;
    if (sim.complete || t < sim.nextSpawnAt) return;
    if (activeCount(sim) < cfg.contactCount.max) {
      const size = ri(sim, sp.size[0], sp.size[1]);
      const made = spawnGroup(sim, size, sp.entry);
      if (made.length) logEvent(sim, made.length > 1 ? made.length + ' new contacts entered sensor range' : made[0].n + ' entered sensor range', 'event');
    }
    sim.nextSpawnAt = t + Math.max(6, Math.round(rr(sim, sp.every) * sim.diff.eventMul / sim.adapt));
  }

  // ---------------- scenario director ----------------
  function candidates(sim, pred) { return sim.contacts.filter(c => c.state === 'active' && (!pred || pred(c))); }
  function pickOne(sim, list) { return list.length ? list[ri(sim, 0, list.length - 1)] : null; }

  function fireEvent(sim, item) {
    const ev = item.ev, t = sim.elapsed, dur = ev.dur ? Math.round(rr(sim, ev.dur)) : 0; let text = ev.label, did = true;
    switch (ev.type) {
      case 'occlude': {
        const pool = candidates(sim, c => c.truth === 'drone' && c.age > 4);
        const c = pickOne(sim, pool.filter(x => x.attended || x.tracked).length ? pool.filter(x => x.attended || x.tracked) : pool) || pickOne(sim, candidates(sim));
        if (c && startOcclusion(sim, c, dur, ev.cause, ev.reappearElsewhere)) text = ev.label + ' (' + c.n + ')'; else did = false; break;
      }
      case 'blink': {
        const c = makeContact(sim, 'micro', { entry: 'interior' });
        if (c) { startOcclusionLater(sim, c, dur); text = ev.label + ' (' + c.n + ')'; } break;
      }
      case 'thermal': {
        const c = pickOne(sim, candidates(sim, x => x.truth === 'drone'));
        if (c) { c.thermalUntil = t + dur; sim.thermalFocus = { id: c.id, until: t + dur }; text = ev.label + ' on ' + c.n; } else did = false; break;
      }
      case 'falsePositive': {
        const key = sim.cfg.id === 'night' || sim.cfg.id === 'urban' || sim.cfg.id === 'mixed' ? 'ghost' : 'benign';
        const c = makeContact(sim, key, { entry: 'interior', fpEvent: true, life: dur || 12 });
        c.vis = { radar: 1, eoir: 0, rf: 0, acoustic: 0 }; c.pattern = 'ghost'; c.speed = 0; text = ev.label + ' (' + c.n + ')'; break;
      }
      case 'crossPaths': {
        const l = candidates(sim, c => c.truth === 'drone' && c.state === 'active');
        if (l.length >= 2) {
          const a = l[0], b = l[1], mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
          [a, b].forEach(c => { c.heading = Math.atan2((mx - c.x) * AR, -(my - c.y)); c.mergeUntil = t + dur; c.mergeWith = null; c.conflictUntil = Math.max(c.conflictUntil, 0); c.target *= .8; c.crossUntil = t + dur; });
          text = ev.label + ' (' + a.n + ' / ' + b.n + ')';
        } else did = false; break;
      }
      case 'merge': {
        const l = candidates(sim, c => !c.mergeWith); let best = null, bd = 1e9;
        for (let i = 0; i < l.length; i++) for (let j = i + 1; j < l.length; j++) { const d = distPct(l[i], l[j]); if (d < bd) { bd = d; best = [l[i], l[j]]; } }
        if (best) { best[0].mergeWith = best[1].id; best[0].mergeUntil = t + dur; best[1].mergeUntil = t + dur; text = ev.label + ' (' + best[0].n + ' + ' + best[1].n + ')'; } else did = false; break;
      }
      case 'spawn': {
        const made = spawnGroup(sim, ev.count || 1, ev.entry || 'edge', ev.kinds, true);
        if (made.length) text = ev.label + ' (' + made.map(m => m.n).join(', ') + ')'; else did = false; break;
      }
      case 'swarmExpand': {
        const made = spawnGroup(sim, ri(sim, ev.count[0], ev.count[1]), 'edge', null, true);
        if (made.length) text = ev.label + ' (' + made.length + ' contacts)'; else did = false; break;
      }
      case 'contactLoss': {
        const c = pickOne(sim, candidates(sim, x => x.truth === 'drone'));
        if (c && startOcclusion(sim, c, dur, 'track', false)) text = ev.label + ' (' + c.n + ')'; else did = false; break;
      }
      case 'dirChange': {
        const gps = sim.groups ? Object.keys(sim.groups) : [];
        gps.forEach(k => { const gp = sim.groups[k]; gp.wpt = { x: gp.wpt && gp.wpt.x > 50 ? 12 + sim.rand() * 22 : 66 + sim.rand() * 22, y: 12 + sim.rand() * 36 }; gp.speed *= 1.25; });
        text = ev.label; break;
      }
      case 'sensorMod': {
        sim.mods.push({ id: ev.id, sensor: ev.sensor, mod: ev.mod, until: t + (dur || 12), confMul: ev.confMul, noiseAdd: ev.noiseAdd });
        text = ev.label; break;
      }
      case 'delayEO': { sim.mods.push({ id: ev.id, sensor: 'eoir', mod: 'delay', until: t + dur }); text = ev.label; break; }
      case 'conflict': {
        const c = pickOne(sim, candidates(sim, x => x.attended || x.nDet >= 1)) || pickOne(sim, candidates(sim));
        if (c) { c.conflictUntil = t + dur; sim.conflictFocus = { id: c.id, until: t + dur }; text = ev.label + ' (' + c.n + ')'; } else did = false; break;
      }
      case 'recover': { sim.mods = sim.mods.filter(m => !(m.mod === 'outage' || m.mod === 'drop')); text = ev.label; break; }
      case 'envChange': {
        sim.envPhase = 1; sim.env = { time: 'Night', weather: 'Rain' }; sim.mission.time = 'Night'; sim.mission.weather = 'Rain';
        sim.mods.push({ id: ev.id + '-eo', sensor: 'eoir', mod: 'env', until: 9999, pMul: .82, noiseAdd: .1 }, { id: ev.id + '-rd', sensor: 'radar', mod: 'env', until: 9999, pMul: .92, noiseAdd: .14 });
        sim.envNote = 'Rain onset: EO/IR reduced, radar clutter increased'; text = ev.label; break;
      }
      case 'multi': {
        const c = pickOne(sim, candidates(sim, x => x.truth === 'drone'));
        if (c) startOcclusion(sim, c, dur, 'building', false);
        sim.mods.push({ id: ev.id, sensor: 'rf', mod: 'outage', until: t + dur });
        spawnGroup(sim, 2, 'edge', null, true); break;
      }
      default: did = false;
    }
    if (did) { sim.counters.eventsTriggered++; sim.eventLog.push({ t, id: ev.id, type: ev.type, text }); logEvent(sim, text, 'event'); if (ev.type !== 'recover') sim.envNote = ev.type === 'envChange' ? sim.envNote : text; }
  }
  function startOcclusionLater(sim, c, dur) { c.blinkUntil = sim.elapsed + dur; c.reappearElsewhere = true; c.occCause = 'darkness'; c.pendingBlink = true; }
  function updateDirector(sim) {
    const t = sim.elapsed;
    sim.contacts.forEach(c => { if (c.pendingBlink && t >= c.blinkUntil) { c.pendingBlink = false; if (startOcclusion(sim, c, 22, 'darkness', true)) { logEvent(sim, c.n + ' fades from view', 'event'); } } });
    if (sim.complete) return;
    sim.schedule.forEach(item => {
      if (item.done || t < item.at) return;
      fireEvent(sim, item);
      const ev = item.ev;
      if (ev.every) item.at = t + Math.max(10, Math.round(rr(sim, ev.every) * sim.diff.eventMul / sim.adapt)); else item.done = true;
    });
    if (sim.thermalFocus && t > sim.thermalFocus.until) sim.thermalFocus = null;
    if (sim.conflictFocus && t > sim.conflictFocus.until) sim.conflictFocus = null;
  }

  // ---------------- scoring helpers ----------------
  function addPts(sim, metric, pts) { const m = sim.M[metric]; if (!m) return; m.sum += clamp(pts, 0, 100); m.n++; }
  function metricVal(sim, k) { const m = sim.M[k]; return (m.sum + PRIOR * PRIOR_W) / (m.n + PRIOR_W); }
  function windows(sim) { const th = sim.cfg.thresholds; return { attend: th.attendWindow * sim.diff.windowMul, resp: th.responseTarget * sim.diff.windowMul, det: th.detectTarget * sim.diff.windowMul, thr: th.classify, need: th.fusionNeeded }; }
  function lagPts(lag, target) { if (lag <= target) return 100; if (lag <= target * 3) return 100 - (lag - target) / (target * 2) * 60; return 30; }

  function recompute(sim) {
    const out = {}; Object.keys(METRICS).forEach(k => out[k] = Math.round(metricVal(sim, k)));
    let s = 0, wsum = 0; for (const k of Object.keys(sim.cfg.scoringWeights)) { s += sim.cfg.scoringWeights[k] * out[k]; wsum += sim.cfg.scoringWeights[k]; }
    // transparent penalty: false escalations and premature commitments cost points regardless of scenario weights (capped)
    const penalty = Math.min(30, Math.round((3 * sim.counters.falseEsc + 0.6 * sim.counters.premature) * 10) / 10);
    sim.metrics = out;
    sim.stats = Object.assign({}, out, { score: Math.max(0, Math.round(s / wsum - penalty)), decision: out.decisionQuality, penalty });
    return sim.stats;
  }

  // per-tick sampling: detection timing, attention, awareness, tracking, response, priority ranks
  function updateAssessment(sim) {
    const t = sim.elapsed, W = windows(sim);
    const live = sim.contacts.filter(c => c.state === 'active');
    live.forEach(c => {
      const d = sim.mode3d ? (c.aimOff == null ? 99 : c.aimOff * 100) : Math.hypot((c.x - sim.cursorX) * AR, c.y - sim.cursorY);
      if (d < 16) { c.cursorOn++; if (c.cursorOn >= 2) markAttended(sim, c, 'cursor'); } else c.cursorOn = 0;
      if (c.detAt == null && c.nDet >= 1 && c.conf >= 40) { c.detAt = t; c.detRange = rangeKm(sim, c); }
      if (c.truth === 'drone' && c.decidableAt == null && c.nDet >= W.need && c.conf >= W.thr) c.decidableAt = t;
      if (c.truth === 'drone' && c.decidableAt != null && !c.handled && !c.slowFlag && t - c.decidableAt > W.resp * 3) { c.slowFlag = true; addPts(sim, 'response', 0); }
      if (c.truth === 'drone' && c.detAt != null && !c.attended && !c.missedFlag && t - c.detAt > W.attend) { c.missedFlag = true; sim.counters.missed++; addPts(sim, 'detection', 0); addPts(sim, 'awareness', 0); logEvent(sim, c.n + ' went unattended (missed detection)', 'sensor'); }
      if (c.needReacq && t - c.reacqSince > 14) { c.needReacq = false; sim.counters.reacqFailed++; addPts(sim, 'tracking', 20); }
    });
    // priority ranking among unhandled live contacts
    const un = live.filter(c => !c.prioScored);
    un.forEach(c => { const r = rangeKm(sim, c) / sim.cfg.fieldKm; c.threat = (1 - clamp(r, 0, 1)) * 60 + clamp(c.kmh / 110, 0, 1) * 20 + c.conf / 100 * 20 + (c.truth === 'drone' ? 3 : 0); });
    un.sort((a, b) => b.threat - a.threat).forEach((c, i) => c.rank = i + 1);
    live.filter(c => c.prioScored).forEach(c => c.rank = 0);
    if (t % 4 === 0) {
      const dr = live.filter(c => c.truth === 'drone' && c.detAt != null);
      if (dr.length) {
        let aw = 0, tk = 0;
        dr.forEach(c => { const fresh = t - c.lastAttend <= W.attend; aw += fresh ? 1 : 0; tk += c.tracked ? (fresh ? 1 : .5) : (fresh ? .35 : 0); });
        addPts(sim, 'awareness', aw / dr.length * 100); addPts(sim, 'tracking', tk / dr.length * 100);
        sim.awareFrac = aw / dr.length;
      }
    }
  }
  function markAttended(sim, c, how) {
    const t = sim.elapsed, W = windows(sim);
    if (!c.attended && c.detAt != null) {
      const lag = t - c.detAt; if (c.truth === 'drone') { addPts(sim, 'detection', lagPts(lag, W.det)); if (c.detRange > sim.cfg.fieldKm * .5) sim.counters.earlyDetect++; }
    }
    if (!c.attended && c.detAt == null && c.truth === 'drone') { addPts(sim, 'detection', 70); }
    c.attended = true; c.lastAttend = t;
    if (c.needReacq) { c.needReacq = false; sim.counters.reacquired++; addPts(sim, 'tracking', 100); logEvent(sim, c.n + ' track re-acquired', 'decision'); }
  }

  // ---------------- decisions ----------------
  function decide(sim, action, contactName) {
    if (!sim.running) return null;
    const c = sim.contacts.find(x => x.n === (contactName || sim.selected)) || sim.contacts.find(x => x.state !== 'gone');
    if (!c) return null;
    const W = windows(sim), t = sim.elapsed, ctr = sim.counters;
    sim.selected = c.n;
    const commitAction = action === 'Classify' || action === 'Escalate' || action === 'Ignore';
    if (commitAction && c.lastCommit === action) { // repeating the same commit is a no-op (no scoring, no log spam)
      return { contact: c, action, quality: 0, tag: 'duplicate', note: 'already recorded', text: c.n + ': ' + action + ' already recorded', duplicate: true };
    }
    const spam = (action === 'Track' || action === 'Monitor') && c.decisionsOn > 0 && t - (c.lastDecisionT == null ? -99 : c.lastDecisionT) < 4;
    c.lastDecisionT = t;
    if (commitAction) c.lastCommit = action;
    const corroborated = c.nDet >= W.need && c.conf >= W.thr, lost = c.state !== 'active';
    const anyOut = SENSORS.some(k => !sim.sensors[k].available && sim.sensors[k].mod);
    const isDrone = c.truth === 'drone';
    let q = 60, tag = 'ok', conf = null, fus = null, note = '', fp = null;
    const firstHandling = !c.handled;
    markAttended(sim, c, 'decision');
    c.decisionsOn++;
    if (lost) { q = (action === 'Track' || action === 'Monitor') ? 80 : 25; tag = (q > 50) ? 'ok' : 'blind'; note = 'no live track'; }
    else switch (action) {
      case 'Classify':
        c.classification = 'Drone'; c.handled = true; c.tracked = true; c.bonus = Math.min(8, c.bonus + 6);
        if (isDrone && corroborated) { q = 100; tag = 'correct'; ctr.classCorrect++; ctr.correctDecisions++; conf = 100; }
        else if (isDrone) { q = 55; tag = 'premature'; ctr.premature++; ctr.classCorrect++; conf = Math.max(10, 100 - (W.thr - c.conf) * 3); note = 'premature - evidence below threshold'; }
        else { q = 8; tag = 'false-positive'; ctr.classWrong++; ctr.falseEsc++; fp = 0; conf = 15; note = 'clutter classified as a drone'; if (c.nDet < W.need) { ctr.premature++; } }
        fus = c.nDet >= W.need ? 100 : c.nDet === 1 ? 45 : 15; break;
      case 'Track':
        c.tracked = true; c.bonus = Math.min(8, c.bonus + 5); if (c.status === 'New Contact' || c.status === 'Detected') c.status = 'Tracking';
        q = isDrone ? 90 : (c.conf < 30 ? 70 : 55); tag = 'ok'; conf = c.conf < W.thr ? 90 : 65; fus = c.nDet >= 2 ? 100 : 70; break;
      case 'Monitor':
        c.tracked = true; c.bonus = Math.min(8, c.bonus + 3);
        q = (!corroborated) ? 85 : (isDrone ? 55 : 82); tag = 'ok'; conf = !corroborated ? 95 : (isDrone ? 55 : 80); fus = null; if (!isDrone) fp = 85; break;
      case 'Escalate':
        c.handled = true; c.tracked = true; c.leaveAt = t + 5;
        if (isDrone && c.classification === 'Drone' && corroborated) { q = 100; tag = 'correct'; ctr.correctDecisions++; conf = 100; }
        else if (isDrone) { q = 45; tag = 'premature'; ctr.premature++; conf = Math.max(10, 100 - (W.thr - c.conf) * 3); note = 'escalated before classification and corroboration'; }
        else { q = 5; tag = 'false-escalation'; ctr.falseEsc++; fp = 0; conf = 10; note = 'false escalation on clutter'; }
        fus = c.nDet >= W.need ? 100 : c.nDet === 1 ? 40 : 15; break;
      case 'Ignore':
        c.handled = true;
        c.classification = 'Clutter'; c.status = 'Ignored';
        if (!isDrone) { q = 95; tag = 'correct'; ctr.correctDecisions++; fp = 100; conf = c.nDet >= W.need ? 70 : 95; }
        else { q = 5; tag = 'missed-threat'; ctr.ignoredThreat++; conf = 40; note = 'dismissed a real contact'; }
        fus = c.nDet >= 2 ? 100 : 55; break;
      default: return null;
    }
    if (action === 'Classify' && c.status !== 'Ignored') c.status = 'Classified';
    if (action === 'Escalate') c.status = 'Escalated';
    if (action === 'Monitor' && !c.handled) c.status = 'Monitoring';
    // metric points
    if (spam) { sim.decisions++; logEvent(sim, c.n + ': ' + action + ' (refresh)', 'decision'); recompute(sim); updateAssessment(sim); return { contact: c, action, quality: q, tag: 'ok', note: 'refresh', text: c.n + ': ' + action + ' refreshed' }; }
    addPts(sim, 'decisionQuality', q);
    if (conf != null) addPts(sim, 'confidenceMgmt', conf);
    if (!lost && (action === 'Classify' || action === 'Escalate' || action === 'Ignore') && fus != null) { addPts(sim, 'sensorFusion', fus); if (c.nDet >= W.need) ctr.fusionDecisions++; if (anyOut && tag === 'correct') ctr.outageDecisions++; }
    else if (!lost && action === 'Track' && fus != null) addPts(sim, 'sensorFusion', fus);
    if (action === 'Classify' && !lost) addPts(sim, 'classification', tag === 'correct' ? 100 : tag === 'premature' ? 30 : 5);
    if (action === 'Ignore' && !isDrone && !lost) addPts(sim, 'classification', 90);
    if (action === 'Ignore' && isDrone && !lost) addPts(sim, 'classification', 10);
    if (fp != null) addPts(sim, 'falsePositive', fp);
    if (!c.prioScored && !lost && (action !== 'Monitor')) {
      c.prioScored = true; const rank = c.rank || 1; ctr.goodPriority += rank <= 2 ? 1 : 0;
      addPts(sim, 'prioritization', rank <= 2 ? 100 : rank <= 4 ? 75 : Math.max(15, 55 - (rank - 4) * 6));
    }
    if (isDrone && !lost && (action === 'Classify' || action === 'Escalate') && c.decidableAt != null && !c.respScored) { c.respScored = true; addPts(sim, 'response', lagPts(t - c.decidableAt, W.resp)); }
    else if (!isDrone && action === 'Ignore' && !lost && !c.respScored) { c.respScored = true; addPts(sim, 'response', lagPts(t - (c.detAt == null ? c.born : c.detAt), W.resp * 2)); }
    sim.decisions++;
    const txt = `${c.n}: ${action} decision recorded` + (note ? ' (' + note + ')' : '');
    logEvent(sim, txt, 'decision');
    recompute(sim); updateAssessment(sim);
    return { contact: c, action, quality: q, tag, note, text: txt };
  }

  // ---------------- main tick ----------------
  function tick(sim) {
    if (!sim.running) return;
    sim.elapsed++;
    const t = sim.elapsed;
    updateDirector(sim);
    updateSpawns(sim);
    stepContacts(sim);
    updateSensors(sim);
    updateEvidence(sim);
    updateConf(sim);
    sim.contacts = sim.contacts.filter(c => c.state !== 'gone' || t - (c.goneAt = c.goneAt || t) < 2);
    updateAssessment(sim);
    // adaptive difficulty: strong performance accelerates the scenario, weak performance eases it (bounded)
    if (t % 10 === 0) { const sc = (sim.stats.score || 55); sim.adapt = clamp(1 + (sc - 70) / 160, .82, 1.22); }
    recompute(sim);
    if (!sim.complete && t >= sim.cfg.durationSec) { sim.complete = true; logEvent(sim, 'Mission window complete - end the session for the after-action review', 'system'); }
    if (t % 3 === 0) captureFrame(sim);
    if (sim.selected && !sim.contacts.find(c => c.n === sim.selected && c.state !== 'gone')) { const nx = sim.contacts.find(c => c.state !== 'gone'); sim.selected = nx ? nx.n : null; }
  }

  function finalize(sim) {
    if (sim.ended) return;
    sim.ended = true;
    sim.contacts.forEach(c => { if (c.state !== 'gone') settleGone(sim, c); });
    recompute(sim);
  }

  function pressure(sim) {
    const un = sim.contacts.filter(c => c.state !== 'gone' && !c.handled).length;
    const bad = SENSORS.filter(k => !sim.sensors[k].available || sim.sensors[k].mod).length;
    return clamp(Math.round(sim.diff.pressureBase + un * 3.2 + bad * 4 + (sim.mods.length ? 3 : 0) - (sim.stats.decision || 60) * .12 + (sim.cfg.id === 'swarm' ? 6 : 0)), 12, 99);
  }

  // ---------------- replay frames ----------------
  function captureFrame(sim) {
    sim.frames.push({
      t: sim.elapsed, env: sim.envPhase,
      c: sim.contacts.filter(c => c.state !== 'gone').map(c => { const p = c.state === 'occluded' && c.lastKnown ? c.lastKnown : c; return [c.id, Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, c.truth === 'drone' ? 1 : 0, c.state === 'occluded' ? 1 : 0, Math.round(c.conf), c.classification === 'Drone' ? 1 : c.classification === 'Clutter' ? 2 : 0, c.fpEvent ? 1 : 0]; }),
      s: SENSORS.map(k => { const S = sim.sensors[k]; return [S.available ? S.shownConf : 0, S.status]; })
    });
    if (sim.frames.length > 140) sim.frames.splice(1, 1);
  }
  function frameAt(sim, t, frames) { frames = frames || sim.frames; let best = frames[0]; for (const f of frames) { if (f.t <= t) best = f; else break; } return best; }

  // ---------------- objectives / summary ----------------
  function objectivesOf(sim) {
    const k = sim.counters, W = windows(sim);
    return sim.cfg.objectives.map(o => {
      let val = 0, done = false, failed = false, show;
      switch (o.kind) {
        case 'classCorrect': val = k.classCorrect; done = val >= o.target; break;
        case 'maxFalseEsc': val = k.falseEsc; done = val <= o.target; failed = val > o.target; break;
        case 'reacquire': val = k.reacquired; done = val >= o.target; break;
        case 'earlyDetect': val = k.earlyDetect; done = val >= o.target; break;
        case 'noPremature': val = k.premature; done = val <= o.target; failed = val > o.target; break;
        case 'fusionDecisions': val = k.fusionDecisions; done = val >= o.target; break;
        case 'attendedFrac': val = Math.round((sim.awareFrac == null ? 0 : sim.awareFrac) * 100); done = val >= o.target; break;
        case 'goodPriority': val = k.goodPriority; done = val >= o.target; break;
        case 'maxMissed': val = k.missed; done = val <= o.target; failed = val > o.target; break;
        case 'outageDecisions': val = k.outageDecisions; done = val >= o.target; break;
        case 'calibration': val = Math.round(sim.metrics.confidenceMgmt); done = val >= o.target; break;
        case 'readiness': val = sim.stats.score; done = val >= o.target; break;
        default: val = 0;
      }
      const upper = ['maxFalseEsc', 'noPremature', 'maxMissed'].includes(o.kind);
      const max = upper || ['attendedFrac', 'calibration', 'readiness'].includes(o.kind);
      show = upper ? `${val}/${o.target} max` : max ? `${val}% / ${o.target}%` : `${val}/${o.target}`;
      if (upper && !failed && !sim.complete && !sim.ended) done = false; // "stay under" objectives are only confirmed at the end
      return { id: o.id, text: o.text, done, failed, show, kind: o.kind };
    });
  }

  function summary(sim) {
    const cfg = sim.cfg, m = sim.metrics || recompute(sim) && sim.metrics;
    return {
      id: cfg.id, name: cfg.name, environment: cfg.environment, envShort: cfg.card.env, timeShort: cfg.card.time, time: sim.mission.time, weather: sim.mission.weather, difficulty: sim.diffName,
      threats: sim.counters.droneSpawned, contacts: sim.counters.spawned, clutter: sim.counters.clutterSpawned, sensors: SENSORS.length,
      score: sim.stats.score, penalty: sim.stats.penalty || 0, metrics: Object.assign({}, m), weights: Object.assign({}, cfg.scoringWeights), aarMetrics: cfg.aarMetrics.slice(),
      counters: Object.assign({}, sim.counters), objectives: objectivesOf(sim), duration: sim.elapsed, decisions: sim.decisions, seed: sim.seed,
      objectiveText: cfg.objectiveText, eventsTriggered: sim.counters.eventsTriggered
    };
  }

  const METRIC_TO_SCENARIO = { sensorFusion: 'degraded', awareness: 'swarm', prioritization: 'swarm', detection: 'border', tracking: 'border', classification: 'urban', falsePositive: 'urban', confidenceMgmt: 'degraded', response: 'mixed', decisionQuality: 'mixed' };
  function recommend(summ) {
    const ms = (summ.aarMetrics || []).slice().sort((a, b) => summ.metrics[a] - summ.metrics[b]);
    const weakest = ms[0] || 'decisionQuality';
    let id = METRIC_TO_SCENARIO[weakest] || 'mixed';
    if (id === summ.id) id = summ.id === 'mixed' ? 'night' : (summ.id === 'night' ? 'degraded' : 'mixed');
    return { id, weakest, reason: 'Weakest area: ' + METRICS[weakest].label };
  }

  Object.assign(NS, { createSim, tick, decide, finalize, pressure, recompute, objectivesOf, summary, recommend, frameAt, captureFrame, rangeKm, bearingDeg, AR, SITE, tc, DET_THRESHOLD });
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
