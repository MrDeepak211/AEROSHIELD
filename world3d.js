/* AEROSHIELD 3D world (Three.js). Renders a real, navigable 3D environment per scenario and a flyable sensor drone.
   The simulation engine (engine.js) stays the source of truth for contacts, sensors, events and scoring; this module
   (a) draws them in 3D, (b) feeds back the sensor-platform position, camera aim and terrain/building line-of-sight.
   Everything is a synthetic training world: no real-world mapping, targeting or weapon control. */
(function (g) {
  'use strict';
  const NS = g.AeroShield = g.AeroShield || {};
  const T = g.THREE;
  const K = 8, AR = 2.5, SITE = { x: 50, y: 94 }, ALT = 0.22;
  const toWorld = (x, y) => ({ x: (x - 50) * AR * K, z: (y - SITE.y) * K });
  const toField = (wx, wz) => ({ x: 50 + wx / (AR * K), y: SITE.y + wz / K });
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const BOUNDS = { x: 1150, zMin: -780, zMax: 60, yMin: 3, yMax: 130 };

  if (!T) { NS.World = { create: () => null, supported: false }; return; }

  // ---------- helpers ----------
  function canvasTex(w, h, draw, repeat) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping; return t;
  }
  function glowTex() { return canvasTex(64, 64, (x, w) => { const g2 = x.createRadialGradient(32, 32, 0, 32, 32, 32); g2.addColorStop(0, 'rgba(255,255,255,1)'); g2.addColorStop(.25, 'rgba(255,255,255,.55)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g2; x.fillRect(0, 0, w, w); }); }
  const GLOW = glowTex();
  function skyTex(stops, opts) {
    opts = opts || {};
    return canvasTex(8, 512, (x, w, h) => {
      const gr = x.createLinearGradient(0, 0, 0, h); stops.forEach(s => gr.addColorStop(s[0], s[1])); x.fillStyle = gr; x.fillRect(0, 0, w, h);
    });
  }
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function mergeGeos(geos, colors) {
    const pos = [], nor = [], uv = [], col = [], idx = []; let off = 0;
    geos.forEach((geo, gi) => {
      const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv, c = colors && colors[gi] ? new T.Color(colors[gi]) : null;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); if (c) col.push(c.r, c.g, c.b); }
      if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + off); else for (let i = 0; i < p.count; i++) idx.push(i + off);
      off += p.count; geo.dispose();
    });
    const m = new T.BufferGeometry();
    m.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); m.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    if (col.length) m.setAttribute('color', new T.Float32BufferAttribute(col, 3)); m.setIndex(idx); return m;
  }
  function boxGeo(x, z, w, d, h, y0) {
    const b = new T.BoxGeometry(w, h, d), uv = b.attributes.uv;
    for (let i = 0; i < 24; i++) {
      const face = Math.floor(i / 4); let su, sv;
      if (face < 2) { su = d / 9; sv = h / 9; } else if (face < 4) { su = w / 9; sv = d / 9; } else { su = w / 9; sv = h / 9; }
      uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    }
    b.translate(x, (y0 || 0) + h / 2, z); return b;
  }
  function facade(litP, tint, emissiveColor) {
    const map = canvasTex(128, 128, (x, w) => { x.fillStyle = tint; x.fillRect(0, 0, w, w); for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { x.fillStyle = 'rgba(14,20,30,.9)'; x.fillRect(c * 16 + 3, r * 16 + 4, 10, 8); } }, true);
    const r = rng(77);
    const em = canvasTex(128, 128, (x, w) => { x.fillStyle = '#000'; x.fillRect(0, 0, w, w); for (let rr = 0; rr < 8; rr++) for (let c = 0; c < 8; c++) if (r() < litP) { x.fillStyle = emissiveColor[Math.floor(r() * emissiveColor.length)]; x.fillRect(c * 16 + 3, rr * 16 + 4, 10, 8); } }, true);
    return { map, em };
  }
  function points(list, color, size, opts) {
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(list, 3));
    const m = new T.PointsMaterial({ size, map: GLOW, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, sizeAttenuation: true, fog: false, opacity: (opts && opts.opacity) || 1 });
    return new T.Points(geo, m);
  }
  function terrain(cx, cz, w, d, sx, sz, hfn, colorFn) {
    const geo = new T.PlaneGeometry(w, d, sx, sz); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position, cols = [];
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + cx, z = p.getZ(i) + cz, h = hfn(x, z); p.setXYZ(i, x, h, z); const c = colorFn(x, z, h); cols.push(c[0], c[1], c[2]); }
    geo.setAttribute('color', new T.Float32BufferAttribute(cols, 3)); geo.computeVertexNormals();
    return new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors: true }));
  }
  const col3 = (hex) => { const c = new T.Color(hex); return [c.r, c.g, c.b]; };
  const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // ---------- scenario environments ----------
  // each builder returns { obstacles:[{minx,maxx,minz,maxz,top}], height(x,z), fog:{color,density}, phases? , update(dt,t,w) }
  function addLights(scene, o) {
    const hemi = new T.HemisphereLight(o.sky, o.ground, o.hemi); scene.add(hemi);
    const sun = new T.DirectionalLight(o.sun, o.sunI); sun.position.set(o.sunDir[0], o.sunDir[1], o.sunDir[2]); scene.add(sun);
    return { hemi, sun };
  }
  function cityBlocks(scene, o) {
    const r = rng(o.seed), specs = [], pads = [], roofs = [], obstacles = [], lights = [], beacons = [];
    const cell = 80;
    for (let gx = Math.floor(o.x0 / cell); gx <= Math.ceil(o.x1 / cell); gx++) for (let gz = Math.floor(o.z0 / cell); gz <= Math.ceil(o.z1 / cell); gz++) {
      const cx = gx * cell, cz = gz * cell;
      if (o.skip && o.skip(cx, cz)) continue;
      lights.push(cx - cell / 2, 6, cz - cell / 2);
      if (r() < (o.gap || .06)) continue;
      const h = o.hMin + Math.pow(r(), o.hPow || 2.2) * (o.hMax - o.hMin), w = 38 + r() * 10, d = 38 + r() * 10;
      const ox = (r() - .5) * 6, oz = (r() - .5) * 6;
      specs.push(boxGeo(cx + ox, cz + oz, w, d, h, 0)); pads.push(boxGeo(cx, cz, 56, 56, .6, 0));
      obstacles.push({ minx: cx + ox - w / 2, maxx: cx + ox + w / 2, minz: cz + oz - d / 2, maxz: cz + oz + d / 2, top: h });
      if (r() < .35) { const ah = 8 + r() * 14; roofs.push(boxGeo(cx + ox, cz + oz, 1.4, 1.4, ah, h)); if (r() < .6) beacons.push(cx + ox, h + ah + 1, cz + oz); }
    }
    const f = facade(o.litP, o.tint, o.emissive);
    const bm = new T.Mesh(mergeGeos(specs), new T.MeshLambertMaterial({ map: f.map, emissiveMap: f.em, emissive: 0xffffff, emissiveIntensity: o.emI }));
    scene.add(bm);
    const padM = new T.Mesh(mergeGeos(pads), new T.MeshLambertMaterial({ color: o.pad })); scene.add(padM);
    if (roofs.length) scene.add(new T.Mesh(mergeGeos(roofs), new T.MeshLambertMaterial({ color: 0x20262e })));
    const lightPts = points(lights, o.lampColor, 7); scene.add(lightPts);
    let beaconPts = null; if (beacons.length) { beaconPts = points(beacons, 0xff3030, 9); scene.add(beaconPts); }
    return { obstacles, mats: { bm, lightPts, beaconPts } };
  }
  function trees(scene, hfn, n, area, seed, color, avoid) {
    const r = rng(seed), geos = [], cols = [];
    for (let i = 0; i < n; i++) {
      const x = area.x0 + r() * (area.x1 - area.x0), z = area.z0 + r() * (area.z1 - area.z0);
      if (avoid && avoid(x, z)) continue;
      const h = 9 + r() * 14, c = new T.ConeGeometry(3.2 + r() * 2, h, 6); c.translate(x, hfn(x, z) + h / 2 + 1, z); geos.push(c); cols.push(color);
    }
    const m = new T.Mesh(mergeGeos(geos, cols), new T.MeshLambertMaterial({ vertexColors: true })); scene.add(m); return m;
  }
  function tower(scene, x, z, y0, h, color, beacon) {
    const grp = new T.Group(); const mat = new T.MeshLambertMaterial({ color });
    const leg = (dx, dz) => { const l = new T.Mesh(new T.CylinderGeometry(.7, 1.1, h, 5), mat); l.position.set(dx, h / 2, dz); l.rotation.z = -dx * .012; l.rotation.x = dz * .012; grp.add(l); };
    leg(-4, -4); leg(4, -4); leg(-4, 4); leg(4, 4);
    const cab = new T.Mesh(new T.BoxGeometry(14, 7, 14), mat); cab.position.y = h + 3.5; grp.add(cab);
    const roof = new T.Mesh(new T.ConeGeometry(11, 6, 4), new T.MeshLambertMaterial({ color: 0x2b2b2b })); roof.position.y = h + 10; roof.rotation.y = Math.PI / 4; grp.add(roof);
    grp.position.set(x, y0, z); scene.add(grp);
    if (beacon) { const p = points([x, y0 + h + 14, z], 0xff2020, 14); scene.add(p); return { grp, beacon: p, obs: { minx: x - 8, maxx: x + 8, minz: z - 8, maxz: z + 8, top: y0 + h + 14 } }; }
    return { grp, obs: { minx: x - 8, maxx: x + 8, minz: z - 8, maxz: z + 8, top: y0 + h + 14 } };
  }

  function buildUrban(scene) {
    const dusk = skyTex([[0, '#1d2b58'], [.35, '#6b4a78'], [.46, '#d9805c'], [.5, '#f6b873'], [.53, '#6b5060'], [1, '#2a2430']]);
    scene.userData.sky = dusk; scene.fog = new T.FogExp2(0x8a5f6e, .0009);
    const L = addLights(scene, { sky: 0xb7a0c8, ground: 0x2a1f24, hemi: .85, sun: 0xffb06a, sunI: .85, sunDir: [-600, 120, -300] });
    const ground = new T.Mesh(new T.PlaneGeometry(5000, 4000).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: 0x15131a })); ground.position.set(0, -.05, -400); scene.add(ground);
    const c = cityBlocks(scene, { seed: 11, x0: -1400, x1: 1400, z0: -1050, z1: 200, hMin: 14, hMax: 92, hPow: 2.4, gap: .05, skip: (x, z) => Math.abs(x) < 90 && z > -90, litP: .3, tint: '#3a3248', emissive: ['#ffd27a', '#ffb867', '#ffe9b0', '#9fe3ff'], emI: .85, pad: 0x2b2733, lampColor: 0xffc878 });
    const tw = [tower(scene, -260, -330, 0, 120, 0x3b3f4c, true), tower(scene, 380, -520, 0, 150, 0x3b3f4c, true), tower(scene, 640, -150, 0, 100, 0x3b3f4c, true)];
    const obstacles = c.obstacles.concat(tw.map(t => t.obs));
    return { obstacles, height: () => 0, phases: null, update(dt, t) { const on = Math.sin(t * 2) > 0; tw.forEach(x => x.beacon.visible = on); if (c.mats.beaconPts) c.mats.beaconPts.visible = on; }, spawn: { x: 0, y: 30, z: -10, yaw: 0 }, lights: L, wind: 0 };
  }

  function borderHeight(x, z) {
    const n = clamp((-z - 200) / 520, 0, 1), ns = n * n * (3 - 2 * n);
    let h = 3 * Math.sin(x * .006) + 3 * Math.sin(z * .007 + 1);
    h += ns * (46 + 52 * Math.abs(Math.sin(x * .0042 + z * .0021)) + 24 * Math.sin(x * .013 + 2) * Math.cos(z * .011));
    [[-700, -650, 150, 190], [300, -760, 170, 220], [880, -560, 120, 160], [-250, -520, 90, 130]].forEach(p => { const dx = x - p[0], dz = z - p[1]; h += p[2] * Math.exp(-(dx * dx + dz * dz) / (2 * p[3] * p[3])); });
    h -= ns * 34 * Math.exp(-Math.pow(x + 120, 2) / (2 * 150 * 150));
    return h;
  }
  function buildBorder(scene) {
    scene.userData.sky = skyTex([[0, '#2f6fb8'], [.38, '#7fb2e0'], [.5, '#dcebf6'], [.52, '#9fb5a0'], [1, '#6a7b55']]); scene.fog = new T.FogExp2(0xbfd6e8, .00038);
    addLights(scene, { sky: 0xcfe6ff, ground: 0x6a5f43, hemi: .9, sun: 0xfff1d0, sunI: 1.1, sunDir: [300, 600, 200] });
    const t = terrain(0, -700, 2900, 1700, 150, 90, borderHeight, (x, z, h) => {
      const rock = col3('#8a8478'), grass = col3('#6b7b44'), dry = col3('#9a8f55'), snow = col3('#e8eef2');
      let c = mix3(grass, dry, sstep(8, 60, h) * .8); c = mix3(c, rock, sstep(55, 110, h)); c = mix3(c, snow, sstep(135, 175, h)); return c;
    });
    scene.add(t);
    trees(scene, borderHeight, 260, { x0: -1300, x1: 1300, z0: -420, z1: 60 }, 5, '#3f5a2e', (x, z) => Math.abs(x) < 120 && z > -160);
    const th = borderHeight(620, -20), tw = tower(scene, 620, -20, th, 48, 0x4a4033, false);
    // sparse structures: huts and a fence line
    const huts = [[-420, -60], [-380, -80], [300, -40], [880, -90]].map(([x, z]) => boxGeo(x, z, 12, 9, 7, borderHeight(x, z)));
    scene.add(new T.Mesh(mergeGeos(huts), new T.MeshLambertMaterial({ color: 0x6b5a46 })));
    const posts = []; for (let x = -1100; x <= 1100; x += 28) posts.push(boxGeo(x, -230 + 18 * Math.sin(x * .004), .8, .8, 4.5, borderHeight(x, -230)));
    scene.add(new T.Mesh(mergeGeos(posts), new T.MeshLambertMaterial({ color: 0x3a3228 })));
    return { obstacles: [tw.obs], height: borderHeight, update() { }, spawn: { x: 520, y: 20, z: -10, yaw: -0.4 }, phases: null };
  }

  function buildNight(scene) {
    scene.userData.sky = skyTex([[0, '#01030a'], [.45, '#0a1830'], [.52, '#142b46'], [.53, '#05080c'], [1, '#05080c']]); scene.fog = new T.FogExp2(0x0b1a2c, .0009);
    addLights(scene, { sky: 0x6f93c8, ground: 0x1c2a36, hemi: 1.15, sun: 0x9fb8ff, sunI: .9, sunDir: [-300, 400, -400] });
    const ground = new T.Mesh(new T.PlaneGeometry(5000, 4000).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: 0x1b2f26 })); ground.position.set(0, -.05, -400); scene.add(ground);
    const c = cityBlocks(scene, { seed: 23, x0: -1400, x1: -120, z0: -1050, z1: 200, hMin: 8, hMax: 46, hPow: 1.6, gap: .18, litP: .14, tint: '#34465e', emissive: ['#ffb54a', '#cfe6ff'], emI: 1.2, pad: 0x1d2a38, lampColor: 0xffb060 });
    trees(scene, () => 0, 420, { x0: 120, x1: 1400, z0: -1050, z1: 200 }, 9, '#1c4a30', (x, z) => Math.abs(x - 600) < 60 && z > -300);
    const tw = [tower(scene, -40, -300, 0, 120, 0x34465e, true), tower(scene, 520, -540, 0, 140, 0x34465e, true), tower(scene, -300, -650, 0, 100, 0x34465e, true)];
    const stars = []; const r = rng(3); for (let i = 0; i < 500; i++) { const a = r() * Math.PI * 2, e = .15 + r() * 1.2; stars.push(Math.cos(a) * Math.cos(e) * 2400, Math.sin(e) * 2400, Math.sin(a) * Math.cos(e) * 2400); }
    const sp = points(stars, 0xcfe6ff, 5); sp.material.depthTest = false; scene.add(sp);
    const moon = points([-900, 1100, -1600], 0xdfe9ff, 120); scene.add(moon);
    return { obstacles: c.obstacles.concat(tw.map(t => t.obs)), height: () => 0, update(dt, t) { const on = Math.sin(t * 1.7) > -.2; tw.forEach(x => x.beacon.visible = on); }, spawn: { x: 0, y: 24, z: -10, yaw: 0 }, phases: null, stars: sp };
  }

  function swarmHeight(x, z) { return 7 * Math.sin(x * .0032) * Math.cos(z * .0041) + 4 * Math.sin(x * .009 + z * .006) + 2; }
  function buildSwarm(scene) {
    scene.userData.sky = skyTex([[0, '#2a4f8c'], [.36, '#8d93b4'], [.47, '#ee9a62'], [.5, '#f6c581'], [.52, '#8c7a50'], [1, '#4c5a30']]); scene.fog = new T.FogExp2(0xe9b184, .00055);
    addLights(scene, { sky: 0xe0c0a0, ground: 0x4c5a30, hemi: .9, sun: 0xffc07a, sunI: 1.0, sunDir: [500, 160, 200] });
    const r = rng(41);
    scene.add(terrain(0, -400, 3400, 1800, 120, 70, swarmHeight, (x, z, h) => { const f = Math.sin(x * .02) * Math.cos(z * .017); return mix3(col3(f > 0 ? '#5d6e35' : '#7b7a3d'), col3('#8a7a4a'), clamp(h / 18, 0, 1) * .6 + (Math.sin(x * .05 + z * .03) > .8 ? .3 : 0)); }));
    const sheds = [], obstacles = [];
    for (let i = 0; i < 46; i++) { const x = -1250 + r() * 2500, z = -760 + r() * 800; if (Math.abs(x) < 100 && z > -120) continue; const w = 14 + r() * 24, d = 12 + r() * 16, h = 6 + r() * 10; sheds.push(boxGeo(x, z, w, d, h, swarmHeight(x, z))); obstacles.push({ minx: x - w / 2, maxx: x + w / 2, minz: z - d / 2, maxz: z + d / 2, top: swarmHeight(x, z) + h }); }
    scene.add(new T.Mesh(mergeGeos(sheds), new T.MeshLambertMaterial({ color: 0x3a3340 })));
    trees(scene, swarmHeight, 160, { x0: -1300, x1: 1300, z0: -760, z1: 40 }, 8, '#3f5a2e', (x, z) => Math.abs(x) < 100 && z > -120);
    const poles = []; for (let x = -1300; x < 1300; x += 60) poles.push(boxGeo(x, -90, .9, .9, 16, swarmHeight(x, -90)));
    scene.add(new T.Mesh(mergeGeos(poles), new T.MeshLambertMaterial({ color: 0x2c2620 })));
    return { obstacles, height: swarmHeight, update() { }, spawn: { x: 0, y: 34, z: -10, yaw: 0 }, phases: null, contactScale: 1.5 };
  }

  function buildDegraded(scene) {
    scene.userData.sky = skyTex([[0, '#8c98a2'], [.5, '#aab4bb'], [.55, '#8d979e'], [1, '#6a737a']]); scene.fog = new T.FogExp2(0xa5afb6, .0034);
    addLights(scene, { sky: 0xc5ced4, ground: 0x59626a, hemi: 1.0, sun: 0xdfe6ea, sunI: .45, sunDir: [200, 400, 100] });
    const ground = new T.Mesh(new T.PlaneGeometry(5000, 4000).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: 0x4a5258 })); ground.position.set(0, -.05, -400); scene.add(ground);
    const r = rng(52), mats = new T.MeshLambertMaterial({ color: 0x2f373d }), obstacles = [];
    const stacks = [[-300, -260, 120], [-250, -280, 95], [-340, -330, 130], [260, -300, 110], [310, -270, 80], [380, -340, 120], [-60, -560, 100], [120, -600, 90]];
    stacks.forEach(([x, z, h]) => { const s = new T.Mesh(new T.CylinderGeometry(7, 9, h, 10), mats); s.position.set(x, h / 2, z); scene.add(s); const band = new T.Mesh(new T.CylinderGeometry(7.2, 7.6, 10, 10), new T.MeshLambertMaterial({ color: 0xb23a3a })); band.position.set(x, h - 8, z); scene.add(band); obstacles.push({ minx: x - 9, maxx: x + 9, minz: z - 9, maxz: z + 9, top: h }); });
    const tanks = [[-120, -180, 22, 26], [160, -200, 26, 30], [-480, -420, 24, 28], [480, -460, 20, 24], [30, -380, 28, 32]];
    tanks.forEach(([x, z, rad, h]) => { const t = new T.Mesh(new T.CylinderGeometry(rad, rad, h, 16), new T.MeshLambertMaterial({ color: 0x6e777d })); t.position.set(x, h / 2, z); scene.add(t); obstacles.push({ minx: x - rad, maxx: x + rad, minz: z - rad, maxz: z + rad, top: h }); });
    const sheds = []; for (let i = 0; i < 26; i++) { const x = -900 + r() * 1800, z = -740 + r() * 700; if (Math.abs(x) < 80 && z > -100) continue; const w = 30 + r() * 40, d = 22 + r() * 24, h = 9 + r() * 12; sheds.push(boxGeo(x, z, w, d, h, 0)); obstacles.push({ minx: x - w / 2, maxx: x + w / 2, minz: z - d / 2, maxz: z + d / 2, top: h }); }
    scene.add(new T.Mesh(mergeGeos(sheds), new T.MeshLambertMaterial({ color: 0x59636a })));
    const rt = new T.Group(); const mast = new T.Mesh(new T.CylinderGeometry(2, 3, 110, 8), mats); mast.position.y = 55; rt.add(mast);
    const dish = new T.Mesh(new T.SphereGeometry(20, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2.4), new T.MeshLambertMaterial({ color: 0xd0d6da, side: T.DoubleSide })); dish.position.y = 112; dish.rotation.x = Math.PI * .85; rt.add(dish); rt.position.set(0, 0, -440); scene.add(rt);
    obstacles.push({ minx: -6, maxx: 6, minz: -446, maxz: -434, top: 125 });
    return { obstacles, height: () => 0, update(dt) { dish.rotation.y += dt * .8; }, spawn: { x: 0, y: 22, z: -10, yaw: 0 }, phases: null };
  }

  function mixedHeight(x, z) { const n = clamp((-z - 250) / 480, 0, 1), e = clamp((x - 100) / 500, 0, 1); let h = 2 * Math.sin(x * .007) + 2 * Math.cos(z * .006); h += n * e * (60 + 70 * Math.abs(Math.sin(x * .004 + z * .003))); h += 140 * Math.exp(-(Math.pow(x - 760, 2) + Math.pow(z + 680, 2)) / (2 * 170 * 170)); return h; }
  function buildMixed(scene) {
    const dusk = skyTex([[0, '#0b1230'], [.4, '#2e3f78'], [.49, '#8a6aa8'], [.52, '#3a3a58'], [1, '#202230']]);
    const night = skyTex([[0, '#01030a'], [.45, '#0a1426'], [.52, '#18283f'], [.53, '#05080c'], [1, '#05080c']]);
    scene.userData.sky = dusk; scene.fog = new T.FogExp2(0x6a5068, .0009);
    const L = addLights(scene, { sky: 0xb09ab8, ground: 0x2a2530, hemi: .8, sun: 0xff9a60, sunI: .8, sunDir: [-500, 100, -300] });
    scene.add(terrain(0, -400, 3400, 1800, 120, 70, mixedHeight, (x, z, h) => mix3(mix3(col3('#4a5a34'), col3('#6a6a50'), sstep(10, 70, h)), col3('#9a9aa0'), sstep(80, 140, h))));
    const c = cityBlocks(scene, { seed: 31, x0: -1300, x1: -80, z0: -900, z1: 160, hMin: 16, hMax: 82, hPow: 1.9, gap: .1, skip: (x, z) => x > -160, litP: .28, tint: '#2e3042', emissive: ['#ffd27a', '#9fe3ff'], emI: .8, pad: 0x24242e, lampColor: 0xffc878 });
    trees(scene, mixedHeight, 220, { x0: 80, x1: 1300, z0: -700, z1: 40 }, 14, '#2f4a2a', (x, z) => Math.abs(x) < 100);
    const tw = tower(scene, 520, -60, mixedHeight(520, -60), 60, 0x30333f, true);
    const rainN = 1400, rp = new Float32Array(rainN * 6); for (let i = 0; i < rainN; i++) { const x = (Math.random() - .5) * 360, y = Math.random() * 160, z = (Math.random() - .5) * 360; rp.set([x, y, z, x - .6, y - 5, z], i * 6); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(rp, 3));
    const rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xb4cdf0, transparent: true, opacity: 0, fog: false })); rain.frustumCulled = false; scene.add(rain);
    const env = { t: 0, target: 0 };
    return {
      obstacles: c.obstacles.concat([tw.obs]), height: mixedHeight, spawn: { x: -40, y: 36, z: -10, yaw: .95 }, rain, setPhase(p) { env.target = p; },
      update(dt, t, w) {
        env.t = lerp(env.t, env.target, 1 - Math.exp(-dt * .5));
        const k = env.t; scene.userData.sky = k > .5 ? night : dusk;
        scene.fog.color.setRGB(lerp(.42, .03, k), lerp(.31, .05, k), lerp(.4, .09, k)); scene.fog.density = lerp(.0009, .0017, k);
        L.hemi.intensity = lerp(.8, .38, k); L.sun.intensity = lerp(.8, .12, k); c.mats.bm.material.emissiveIntensity = lerp(.8, 1.1, k);
        rain.material.opacity = k * .55; tw.beacon.visible = Math.sin(t * 2) > 0;
        if (k > .05) { const p = rain.geometry.attributes.position; for (let i = 0; i < rainN; i++) { for (let j = 0; j < 2; j++) { const o = i * 6 + j * 3 + 1; p.array[o] -= 140 * dt; } if (p.array[i * 6 + 1] < 0) { const dy = 160; p.array[i * 6 + 1] += dy; p.array[i * 6 + 4] += dy; } } p.needsUpdate = true; rain.position.set(w.player.x, w.player.y - 30, w.player.z); }
      }
    };
  }
  const BUILDERS = { urban: buildUrban, border: buildBorder, night: buildNight, swarm: buildSwarm, degraded: buildDegraded, mixed: buildMixed };

  // ---------- drone / contact models ----------
  function rotorDisc(r) { return new T.Mesh(new T.CylinderGeometry(r, r, .05, 14), new T.MeshBasicMaterial({ color: 0x9aa7b3, transparent: true, opacity: .35, depthWrite: false })); }
  function quadModel(o) {
    const grp = new T.Group(), rotors = [], body = new T.Mesh(new T.BoxGeometry(1.1, .4, 1.1), new T.MeshLambertMaterial({ color: o.body }));
    grp.add(body);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
      const arm = new T.Mesh(new T.BoxGeometry(1.5, .1, .12), new T.MeshLambertMaterial({ color: o.body })); arm.position.set(sx * .8, 0, sz * .8); arm.rotation.y = sx * sz * Math.PI / 4; grp.add(arm);
      const rd = rotorDisc(.62); rd.position.set(sx * 1.25, .12, sz * 1.25); grp.add(rd); rotors.push(rd);
    });
    const led = points([0, .35, 1.1, 0, .35, -1.1], o.led, o.ledSize || 2.6); grp.add(led);
    grp.userData = { rotors, led };
    grp.scale.setScalar(o.scale); return grp;
  }
  function fixedModel(scale) {
    const grp = new T.Group(), m = new T.MeshLambertMaterial({ color: 0x4a525a });
    const fus = new T.Mesh(new T.CylinderGeometry(.28, .22, 3.4, 8), m); fus.rotation.z = Math.PI / 2; grp.add(fus);
    const wing = new T.Mesh(new T.BoxGeometry(.8, .06, 5.2), m); wing.position.x = .2; grp.add(wing);
    const tail = new T.Mesh(new T.BoxGeometry(.6, .05, 1.6), m); tail.position.x = -1.5; grp.add(tail);
    const fin = new T.Mesh(new T.BoxGeometry(.6, .8, .05), m); fin.position.set(-1.5, .4, 0); grp.add(fin);
    const prop = rotorDisc(.55); prop.rotation.z = Math.PI / 2; prop.position.x = 1.75; grp.add(prop);
    const led = points([.1, .1, 2.6, .1, .1, -2.6], 0xff3030, 2.6); grp.add(led);
    grp.userData = { rotors: [prop], led, prop: true }; grp.scale.setScalar(scale); return grp;
  }
  function birdModel(scale) {
    const grp = new T.Group(), m = new T.MeshLambertMaterial({ color: 0x15171a, side: T.DoubleSide });
    const body = new T.Mesh(new T.SphereGeometry(.3, 6, 5), m); body.scale.set(1.6, .8, .8); grp.add(body);
    const wl = new T.Mesh(new T.PlaneGeometry(1.1, .5), m), wr = new T.Mesh(new T.PlaneGeometry(1.1, .5), m);
    wl.position.z = -.7; wr.position.z = .7; wl.rotation.x = Math.PI / 2; wr.rotation.x = Math.PI / 2; grp.add(wl); grp.add(wr);
    grp.userData = { wings: [wl, wr] }; grp.scale.setScalar(scale); return grp;
  }
  function balloonModel(scale) {
    const grp = new T.Group(); const b = new T.Mesh(new T.SphereGeometry(.9, 10, 8), new T.MeshLambertMaterial({ color: 0xd9d4c4, emissive: 0x222018 })); grp.add(b);
    const s = new T.Mesh(new T.CylinderGeometry(.02, .02, 3, 3), new T.MeshBasicMaterial({ color: 0x777777 })); s.position.y = -2.4; grp.add(s);
    const bk = new T.Mesh(new T.BoxGeometry(.4, .3, .4), new T.MeshLambertMaterial({ color: 0x555555 })); bk.position.y = -4; grp.add(bk);
    grp.userData = { bob: true }; grp.scale.setScalar(scale); return grp;
  }
  function ghostModel(scale) {
    const m = new T.Mesh(new T.SphereGeometry(1.4, 10, 8), new T.MeshBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: .16, depthWrite: false, blending: T.AdditiveBlending }));
    m.scale.setScalar(scale); m.userData = { ghost: true }; return m;
  }
  function buildContactModel(c, world) {
    const sc = (world.env.contactScale || 1) * 3.3;
    let m;
    switch (c.type) {
      case 'fixed': m = fixedModel(sc * 1.15); break;
      case 'micro': m = quadModel({ body: 0x1d2228, led: 0xff4040, scale: sc * .6, ledSize: 2.2 }); break;
      case 'unknown': m = quadModel({ body: 0x59606a, led: 0xffb040, scale: sc * .95 }); break;
      case 'benign': m = balloonModel(sc * .9); break;
      case 'bird': m = birdModel(sc * 1.1); break;
      case 'ghost': m = ghostModel(sc * 2.2); break;
      default: m = quadModel({ body: 0x2a2f36, led: 0xff3a3a, scale: sc });
    }
    // hot glow: thermal / night readability for drone-like contacts
    if (c.type !== 'ghost' && c.type !== 'bird') { const gl = points([0, 0, 0], world.theme === 'night' ? 0xff9a55 : 0xff5a4a, world.theme === 'night' ? 16 : 8, { opacity: world.theme === 'night' ? .9 : .5 }); m.add(gl); m.userData.glow = gl; }
    return m;
  }

  // ---------- the world ----------
  function create(container, sim, opts) {
    opts = opts || {};
    let renderer;
    try {
      renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    } catch (e) { console.warn('[AEROSHIELD] WebGL unavailable', e); return null; }
    renderer.setPixelRatio(Math.min(g.devicePixelRatio || 1, 1.5));
    const cfg = sim.cfg, scene = new T.Scene();
    const env = BUILDERS[cfg.id] ? BUILDERS[cfg.id](scene) : BUILDERS.urban(scene);
    const camera = new T.PerspectiveCamera(64, 1.8, .5, 6000);
    const dome = new T.Mesh(new T.SphereGeometry(3200, 28, 18), new T.MeshBasicMaterial({ map: scene.userData.sky, side: T.BackSide, fog: false, depthWrite: false }));
    dome.renderOrder = -10; dome.frustumCulled = false; scene.add(dome);
    scene.background = scene.fog ? scene.fog.color.clone() : new T.Color(0x000000);
    const sp = sim.player || (sim.player = { x: env.spawn.x, y: env.spawn.y, z: env.spawn.z, yaw: env.spawn.yaw, vf: 0, vs: 0, vy: 0, yawRate: 0, pitch: 0, roll: 0, speed: 0 });
    const w = {
      renderer, scene, camera, env, theme: cfg.theme, sim, player: sp, view: sim.view || 'chase', input: { lx: 0, ly: 0, rx: 0, ry: 0 }, time: 0,
      meshes: new Map(), markers: new Map(), markerLayer: opts.markerLayer, markerHTML: opts.markerHTML, container, shake: 0, disposed: false,
      hud: { alt: 0, spd: 0, hdg: 0 }, collisions: 0, frames: 0
    };
    renderer.domElement.className = 'world3dCanvas'; renderer.domElement.setAttribute('aria-label', '3D scenario view'); container.appendChild(renderer.domElement);
    // player drone
    const pd = quadModel({ body: 0x2f3a46, led: 0x2df0bd, scale: 1.6, ledSize: 1.6 });
    const gim = new T.Mesh(new T.SphereGeometry(.35, 8, 6), new T.MeshLambertMaterial({ color: 0x111418 })); gim.position.y = -.4; pd.add(gim);
    scene.add(pd); w.drone = pd;
    function resize() { const r = container.getBoundingClientRect(); const wd = Math.max(160, r.width), ht = Math.max(120, r.height); renderer.setSize(wd, ht, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; camera.aspect = wd / ht; camera.updateProjectionMatrix(); }
    resize(); const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null; if (ro) ro.observe(container);
    w.groundH = (x, z) => env.height(x, z);

    function floorAt(x, z) { return env.height(x, z); }
    function pushOut(p) {
      for (const o of env.obstacles) {
        if (p.y > o.top + 2) continue;
        if (p.x > o.minx - 3 && p.x < o.maxx + 3 && p.z > o.minz - 3 && p.z < o.maxz + 3) {
          const dl = p.x - (o.minx - 3), dr = (o.maxx + 3) - p.x, du = p.z - (o.minz - 3), dd = (o.maxz + 3) - p.z, m = Math.min(dl, dr, du, dd);
          if (m === dl) p.x = o.minx - 3; else if (m === dr) p.x = o.maxx + 3; else if (m === du) p.z = o.minz - 3; else p.z = o.maxz + 3;
          p.vf *= .3; p.vs *= .3; w.collisions++;
        }
      }
    }
    w.los = function (a, b) {
      const N = 26;
      for (let i = 1; i < N; i++) {
        const t = i / N, x = lerp(a.x, b.x, t), y = lerp(a.y, b.y, t), z = lerp(a.z, b.z, t);
        if (y < floorAt(x, z) + .5) return 0;
        for (const o of env.obstacles) if (y < o.top && x > o.minx && x < o.maxx && z > o.minz && z < o.maxz) return 0;
      }
      return 1;
    };
    function contactWorldPos(c) {
      const src = c.state === 'occluded' && c.lastKnown ? c.lastKnown : c, wp = toWorld(src.x, src.y);
      let y = 6 + c.alt * ALT; if (c.type === 'bird' || c.type === 'ghost') y = 4 + c.alt * ALT * .6;
      const gh = floorAt(wp.x, wp.z); y = Math.max(y, gh + 8);
      for (const o of env.obstacles) if (wp.x > o.minx - 2 && wp.x < o.maxx + 2 && wp.z > o.minz - 2 && wp.z < o.maxz + 2) y = Math.max(y, o.top + 6);
      return new T.Vector3(wp.x, y, wp.z);
    }
    const v3 = new T.Vector3();

    // sync engine contacts -> meshes / markers (once per sim tick)
    w.sync = function (s) {
      const seen = new Set();
      s.contacts.forEach(c => {
        if (c.state === 'gone') return; seen.add(c.n);
        let rec = w.meshes.get(c.n);
        if (!rec) { const mesh = buildContactModel(c, w); const tp = contactWorldPos(c); mesh.position.copy(tp); scene.add(mesh); rec = { mesh, target: tp, c, heading: 0 }; w.meshes.set(c.n, rec); }
        rec.c = c; rec.target = contactWorldPos(c); rec.mesh.visible = c.state === 'active';
        rec.heading = c.heading;
      });
      for (const [n, rec] of Array.from(w.meshes)) if (!seen.has(n)) { scene.remove(rec.mesh); w.meshes.delete(n); }
      // line of sight from the drone to every active contact (drives EO/IR + radar masking)
      const eye = { x: sp.x, y: sp.y, z: sp.z };
      s.contacts.forEach(c => { const rec = w.meshes.get(c.n); if (rec && c.state === 'active') c.los = w.los(eye, rec.target); });
      if (env.setPhase) env.setPhase(s.envPhase || 0);
      w.refreshMarkers(s);
    };
    w.refreshMarkers = function (s) {
      if (!w.markerLayer || !w.markerHTML) return;
      const live = s.contacts.filter(c => c.state !== 'gone'), names = new Set(live.map(c => c.n));
      live.forEach(c => {
        let el = w.markers.get(c.n); const h = w.markerHTML(c);
        if (!el) { el = document.createElement('button'); el.dataset.contact = c.n; el.style.left = '0px'; el.style.top = '0px'; w.markerLayer.appendChild(el); w.markers.set(c.n, el); }
        if (el.className !== h.cls) el.className = h.cls; if (el._html !== h.html) { el.innerHTML = h.html; el._html = h.html; }
      });
      for (const [n, el] of Array.from(w.markers)) if (!names.has(n)) { el.remove(); w.markers.delete(n); }
    };

    const fwd = new T.Vector3(), tmp = new T.Vector3(), look = new T.Vector3(), camPos = new T.Vector3();
    w.camPosInit = false;
    w.update = function (dt, input) {
      if (w.disposed) return;
      dt = Math.min(dt, .1); w.time += dt; w.frames++;
      const inp = input || w.input, p = sp;
      // --- flight model (Mode 2): left stick = throttle + yaw, right stick = forward/back + strafe ---
      const tvf = clamp(inp.ry, -1, 1) * 46, tvs = clamp(inp.rx, -1, 1) * 38, tvy = clamp(inp.ly, -1, 1) * 26, tyr = clamp(inp.lx, -1, 1) * 1.6;
      const k = 1 - Math.exp(-dt * 4.2);
      p.vf = lerp(p.vf, tvf, k); p.vs = lerp(p.vs, tvs, k); p.vy = lerp(p.vy || 0, tvy, k); p.yawRate = lerp(p.yawRate, tyr, 1 - Math.exp(-dt * 6));
      p.yaw += p.yawRate * dt;
      const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw), rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
      p.x += (fx * p.vf + rx * p.vs) * dt; p.z += (fz * p.vf + rz * p.vs) * dt; p.y += p.vy * dt;
      p.x = clamp(p.x, -BOUNDS.x, BOUNDS.x); p.z = clamp(p.z, BOUNDS.zMin, BOUNDS.zMax);
      const fl = floorAt(p.x, p.z) + 3; p.y = clamp(p.y, Math.max(BOUNDS.yMin, fl), BOUNDS.yMax + fl * .3);
      pushOut(p);
      p.speed = Math.hypot(p.vf, p.vs);
      p.pitch = lerp(p.pitch, clamp(p.vf / 46, -1, 1) * .28, k); p.roll = lerp(p.roll, clamp(p.vs / 38, -1, 1) * -.32, k);
      p.yaw = ((p.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      // drone mesh
      w.drone.position.set(p.x, p.y + Math.sin(w.time * 3) * .12, p.z); w.drone.rotation.set(p.pitch, -p.yaw, p.roll, 'YXZ');
      w.drone.rotation.y = -p.yaw; w.drone.userData.rotors.forEach(r => r.rotation.y += dt * 60);
      w.drone.visible = w.view === 'chase';
      // sensor platform position feeds the engine (range/bearing are measured from the drone)
      const f = toField(p.x, p.z); sim.sensorPos.x = clamp(f.x, 0, 100); sim.sensorPos.y = clamp(f.y, 0, 100);
      // --- camera ---
      fwd.set(fx, 0, fz);
      if (w.view === 'fpv') { camPos.set(p.x + fx * 1.6, p.y + .3, p.z + fz * 1.6); look.set(p.x + fx * 60, p.y + 60 * Math.tan(-p.pitch * .6), p.z + fz * 60); }
      else { camPos.set(p.x - fx * 17, p.y + 6.5, p.z - fz * 17); look.set(p.x + fx * 24, p.y + 1.5 - p.pitch * 10, p.z + fz * 24); }
      const gc = floorAt(camPos.x, camPos.z) + 2; if (camPos.y < gc) camPos.y = gc;
      if (!w.camPosInit || w.view === 'fpv') { camera.position.copy(camPos); w.camPosInit = true; } else camera.position.lerp(camPos, 1 - Math.exp(-dt * 7));
      if (w.shake > 0) { camera.position.x += (Math.random() - .5) * w.shake; camera.position.y += (Math.random() - .5) * w.shake; }
      camera.up.set(0, 1, 0); camera.lookAt(look);
      if (w.view === 'fpv') camera.rotateZ(p.roll * .6);
      // --- contacts: smooth follow + animation ---
      const sc = w.env.contactScale || 1;
      w.meshes.forEach(rec => {
        const m = rec.mesh, u = m.userData, kk = 1 - Math.exp(-dt * 3.2), prev = m.position.clone();
        m.position.lerp(rec.target, kk);
        const mv = tmp.copy(m.position).sub(prev);
        if (mv.lengthSq() > 1e-5 && !(u.ghost)) { const yaw = Math.atan2(mv.x, mv.z); const want = yaw - (u.prop ? Math.PI / 2 : 0); let da = want - m.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da)); m.rotation.y += da * .15; }
        if (u.rotors) u.rotors.forEach(r => r.rotation.y += dt * 70);
        if (u.wings) { const a = Math.sin(w.time * 14 + rec.c.id) * .8; u.wings[0].rotation.x = Math.PI / 2 + a; u.wings[1].rotation.x = Math.PI / 2 - a; }
        if (u.bob) m.position.y += Math.sin(w.time * 1.4 + rec.c.id) * .02;
        if (u.ghost) m.material.opacity = .08 + .12 * Math.abs(Math.sin(w.time * 5 + rec.c.id));
        if (u.led && u.led.material) u.led.visible = Math.sin(w.time * 6 + rec.c.id) > -.3;
        if (u.glow) u.glow.material.opacity = (w.theme === 'night' ? .75 : .4) + .25 * Math.sin(w.time * 3 + rec.c.id);
      });
      if (env.update) env.update(dt, w.time, w);
      // follow sky dome (background is a texture; nothing to move) -- stars follow camera
      if (env.stars) env.stars.position.copy(camera.position);
      dome.position.copy(camera.position); if (dome.material.map !== scene.userData.sky) { dome.material.map = scene.userData.sky; dome.material.needsUpdate = true; }
      if (scene.fog) scene.background.copy(scene.fog.color);
      camera.updateMatrixWorld(true);
      if (!NS.World.noRender) renderer.render(scene, camera); // noRender is only used by the automated tests' fast-forward loops
      // --- aim + marker projection ---
      const rect = renderer.domElement.getBoundingClientRect(), cw = rect.width, ch = rect.height;
      w.meshes.forEach((rec, n) => {
        const c = rec.c; v3.copy(c.state === 'occluded' && c.lastKnown ? rec.target : rec.mesh.position); v3.y += 3;
        v3.project(camera); const front = v3.z < 1 && v3.z > -1;
        c.aimOff = front ? Math.hypot(v3.x, v3.y) : null; c.ndcX = front ? v3.x : null; c.ndcY = front ? v3.y : null;
        const el = w.markers.get(n);
        if (el) {
          const vis = front && Math.abs(v3.x) < 1.04 && Math.abs(v3.y) < 1.04;
          if (vis) { el.style.transform = `translate(${((v3.x * .5 + .5) * cw).toFixed(1)}px,${((-v3.y * .5 + .5) * ch).toFixed(1)}px) translate(-50%,-115%)`; el.style.visibility = 'visible'; }
          else el.style.visibility = 'hidden';
          el._vis = vis; el._d = rec.mesh.position.distanceTo(camera.position);
        }
      });
      w.hud.alt = Math.round(p.y * 3); w.hud.spd = Math.round(p.speed * 1.8); w.hud.hdg = Math.round(p.yaw * 180 / Math.PI) % 360;
    };
    w.lockNearest = function () {
      let best = null, bd = .45; w.meshes.forEach(rec => { const c = rec.c; if (c.state === 'active' && c.aimOff != null && c.aimOff < bd) { bd = c.aimOff; best = c; } }); return best;
    };
    w.setView = function (v) { w.view = v; sim.view = v; };
    w.setShake = function (v) { w.shake = v; };
    w.setThermal = function (on) { renderer.domElement.classList.toggle('thermal', !!on); };
    w.dispose = function () {
      w.disposed = true; if (ro) ro.disconnect();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(mm => { if (mm.map) mm.map.dispose(); mm.dispose(); }); } });
      renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      w.markers.forEach(el => el.remove()); w.markers.clear();
    };
    w.sync(sim);
    return w;
  }
  NS.World = { create, supported: true, toWorld, toField, K, AR, BOUNDS };
})(typeof window !== 'undefined' ? window : globalThis);
