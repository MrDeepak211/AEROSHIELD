# AEROSHIELD V25.3 — SCENARIO-DRIVEN 3D TRAINING GAME

Standalone, dependency-free AEROSHIELD prototype for SIH26247.

## Run

Requirements: Node.js 18+

```bash
npm run dev
```

Open http://127.0.0.1:5173

No `npm install` is required. There are zero runtime npm dependencies, and there is no bundler: this is a static app served by `server.cjs`.

```bash
npm run build   # validation: syntax + assets + scenario data + headless engine run of all 6 scenarios
npm run test:e2e # browser test of all 6 scenarios in 3D (needs python playwright + chromium, server running; ~12 min)
```

## Training

1. Open **Scenarios** and press **Start** on a scenario card (or call `startTraining('urban'|'border'|'night'|'swarm'|'degraded'|'mixed')`). **Training** / **Start Training** restarts the last scenario.
2. The mission starts immediately and loads that scenario's configuration.
3. Select contacts on the battlefield.
4. Use **Classify / Track / Monitor / Escalate / Ignore**.
5. Move the virtual joystick with mouse/touch, or use **W/A/S/D** or arrow keys.
6. Click **Replay** for event replay.
7. Click **End Session** for AAR.

## Included

Home, Features, Scenarios, Training, Analytics/AAR, Readiness, Instructor, Command Deck, Judge Mode and About.

All contacts, decisions, scoring and instructor actions are synthetic training events. This prototype does not provide real-world targeting or weapon-control functionality.

## V25.1 stability notes

- **Training layout/black-screen root cause:** the templates used XML-style self-closing tags (`<div class="rr one"/>`, `<i/>`, `<span/>`). HTML does not treat those as self-closing, so each one opened an element that was never closed and swallowed everything after it. The Training view collapsed (decision row, sensor/contact panels and joystick were nested inside the wrong containers). All 22 were fixed and `npm run build` now fails if one reappears.
- **Training no longer re-renders itself every second.** The clock, contacts, telemetry, score and panels are patched in place, so buttons stay clickable and the joystick keeps working while the clock ticks.
- **One engine owns** the timer, joystick (mouse/touch/pointer), WASD/arrow keys and the optional browser Gamepad API. It is stopped on every page change, session restart and session end (no leaked timers or key listeners). The joystick moves only the on-screen *simulated sensor cursor*.
- **Replay** is guarded: with no events it shows "No replay events available."; Esc/× closes it; its timer is always cleaned up; keyboard cursor control is ignored while it is open.
- **Recovery screen:** if a view genuinely throws, the real error is logged to the console and a visible recovery panel (Restart Training / Go Home) is shown, with the header still usable.
- Header navigation now scrolls inside its own row on small screens instead of overflowing, and is available on phones.

Not present in this build's JavaScript: Branching scenarios, Scenario Director and Training DNA panels (only leftover CSS exists). They were not added in this pass.

## V25.2 — Scenario-driven Training Engine

**Root cause of "every scenario is the same":** the old `startSession(mission)` only copied a title/environment string onto one hard-coded simulation (same background image, same 3 contacts, same sensor values, same score weights, same AAR). Nothing in the engine read the scenario.

**Architecture** (`scenarios.js` + `engine.js` are pure data/logic with no DOM; `app.js` only renders):

```
scenarios.js  SCENARIOS[id] = { id, name, environment, terrain, time, weather, visibility, threatProfile,
              contactCount, contactTypes, spawnPattern, movementPattern, sensorProfile, sensorDegradation,
              eventPool, objectives, difficulty, scoringWeights, briefing, aarMetrics, thresholds }
              DIFFICULTY[...] -> contact count / speed / event frequency / sensor reliability / confidence gain / decision window
              TYPES (contact library), METRICS, sceneSVG() (generated per-scenario battlefield scene)
engine.js     createSim(id) -> contacts (spawn + movement patterns) -> sensors (availability, noise, range, pDetect, status)
              -> evidence/confidence -> Scenario Director (scenario-aware events) -> decisions -> scenario-weighted scoring
              -> objectives -> replay frames -> summary()/recommend() for the AAR
app.js        Training view, sensor feeds (EO/IR, Thermal, Radar, RF, Acoustic), AAR, Replay, Readiness
```

Contacts have hidden ground truth (drone vs clutter). Decisions are scored against it and against sensor corroboration, so "Classify" on a radar-only clutter echo is a false positive, and classifying before evidence is sufficient is *premature*. Everything remains a synthetic training exercise; there is no targeting or weapon-control functionality.

| Scenario | Contacts at start | Difficulty | Primary skill | Scoring weights |
|---|---|---|---|---|
| Urban Perimeter | 2–4 | Medium | classify vs clutter | Classification 35 / Tracking 25 / Awareness 20 / Response 20 |
| Border Surveillance | 1–3 | High | early long-range detection | Detection 35 / Tracking 30 / Classification 20 / Response 15 |
| Night Infiltration | 2–4 | High | thermal + sensor correlation | Detection 30 / Sensor Fusion 30 / Classification 25 / Response 15 |
| Swarm Attack | 8–12 (max 15) | Very High | prioritisation + awareness | Awareness 35 / Prioritisation 30 / Tracking 20 / Response 15 |
| Degraded Sensors | 2–4 | High | decide under missing data | Sensor Fusion 35 / Decision Quality 30 / Confidence 20 / Response 15 |
| Mixed Threats | 4–6 (max 10) | Extreme | complete capability | 8 metrics, 12.5 each |

To add a scenario, add an entry to `SCENARIOS` (and its id to `ORDER`); `npm run build` validates the configuration.

Honest limits: `assets/training-bg.jpg` is no longer used by Training (it had contact boxes and HUD icons baked into the image); the Training world is 3D (V25.3), and generated SVG scenes are used only for the Replay stage and the no-WebGL fallback. The scenario card images are the original assets. Scores start from a neutral prior (about 55) and move as evidence accumulates.

## V25.3 — Real 3D world and two-stick drone flight

Training is now a navigable 3D game (Three.js r149, vendored in `vendor/`, no CDN or internet needed). You fly a sensor drone through a different 3D environment for each scenario; the camera follows the drone, so the background moves as you fly.

**Controls (Mode 2, two independent sticks)** — on-screen sticks (mouse/touch), keyboard and gamepad all work together:

| Stick | Vertical | Horizontal | Keyboard |
|---|---|---|---|
| LEFT  | throttle: climb / descend | yaw: turn left / right | `W` `S` altitude, `A` `D` yaw |
| RIGHT | fly forward / backward | strafe left / right | `↑` `↓` forward/back, `←` `→` strafe |

Other keys: `E` lock the contact under the crosshair, `V` chase / first-person view, `1`-`5` Classify / Track / Monitor / Escalate / Ignore. Gamepad: left stick = axes 0/1, right stick = axes 2/3.

**What is real in 3D:** buildings, terrain and structures are solid (collision for the drone) and block sensor line of sight (a building or ridge between you and a contact lowers EO/IR and radar evidence). Range, bearing and sensor coverage are measured from your drone, not from a fixed point. Weather and time change in 3D (Mixed: dusk to night + rain). Per scenario: Urban = dense city with beacon towers at dusk; Border = mountains, valleys, observation tower, clear sky; Night = dark rural/urban edge, stars, thermal-style view (switch the feed tab to Thermal); Swarm = wide open golden-hour field with many contacts; Degraded = foggy industrial site with a rotating radar dish; Mixed = city edge + ridge + tower with a dusk-to-night rain transition.

Files: `world3d.js` (3D scenes, drone physics, contact models, LOS, marker projection), `vendor/three.min.js` (+ licence). If WebGL is unavailable the app falls back to the flat scene and tells you so.

Honest limits: scenes are procedurally generated (no photo-real assets); the world is stylised, not to physical scale (field kilometres are simulated); the AAR Replay still reconstructs events on a 2D scene rather than re-flying your route in 3D; the sensor-feed panels are schematic displays (the EO/IR/Thermal panel follows the camera view).

## V25.3 — Real 3D game (Three.js)

Training is now a navigable 3D world. You fly a sensor drone through a different 3D environment per scenario; the contacts are 3D drones/birds/balloons flying in that world, and the sensors measure *from your drone*.

**Controls (Mode-2 two-stick layout, different job per stick)**

| | Left stick | Right stick |
|---|---|---|
| Push up / down | **Throttle** — climb / descend | **Move** — forward / backward |
| Push left / right | **Yaw** — turn left / right | **Strafe** — slide left / right |
| Keyboard | `W` `S` / `A` `D` | `↑` `↓` / `←` `→` |

Both on-screen sticks work with mouse or touch (multi-touch, so both can be held at once) and recentre on release. A connected gamepad is also read (left axes 0/1, right axes 2/3). Other keys: `E` lock the contact under the crosshair, `V` chase / first-person view, `1`–`5` Classify / Track / Monitor / Escalate / Ignore.

**What is real 3D**
- Camera follows the drone (chase or FPV); the world, sky, fog, lighting and parallax change as you fly.
- Urban/Mixed: generated city blocks with collision and rooftops; Border/Mixed/Swarm: height-field terrain; Night: moonlit city edge, treeline and stars; Degraded: industrial site in dense fog; Mixed: dusk → night with rain.
- Collision with buildings/structures and the ground; world bounds.
- **Line of sight is geometric**: a building or ridge between your drone and a contact lowers EO/IR (strongly), radar, RF and acoustic evidence for that contact.
- Range/bearing/detection are measured from your drone; aiming the crosshair at a contact boosts EO/IR (more at night) and counts as attending it.

**Files:** `vendor/three.min.js` (Three.js r149, MIT, no CDN), `world3d.js` (worlds, flight model, contacts, LOS), `engine.js` (simulation/scoring), `scenarios.js` (scenario data), `app.js` (UI).

**Requirements & honest limits**
- Needs WebGL (any current browser; no GPU is required but a GPU is recommended). If WebGL is unavailable the app falls back to the flat 2D scene so Training never shows a blank screen.
- The world is stylised and procedurally generated (no external models/textures), not photoreal.
- Sensor feed panels (radar/RF/acoustic) are schematic displays; EO/IR and Thermal show contacts where the 3D camera sees them.
- The Replay stage is still the 2D event reconstruction (not a 3D flythrough).
- Automated tests run with software WebGL; real-GPU frame rate was not measured.

## V25.3 — 3D game world (Three.js)

Training is now a real-time 3D game. You fly a **sensor drone** through a scenario-specific 3D world; the chase camera follows you, the sky/terrain/buildings are real geometry, and the simulation engine's contacts are flying objects in that world. `vendor/three.min.js` (Three.js r149, MIT licence in `vendor/three.LICENSE.txt`) is bundled, so it runs offline with no CDN.

**Controls (Mode-2 drone layout — two sticks with different jobs)**

| Stick | On-screen | Keyboard | Does |
|---|---|---|---|
| LEFT | up / down | `W` / `S` | throttle: climb / descend |
| LEFT | left / right | `A` / `D` | yaw: turn the drone |
| RIGHT | up / down | `↑` / `↓` | fly forward / backward |
| RIGHT | left / right | `←` / `→` | strafe left / right |

Gamepad: standard layout (left stick axes 0/1, right stick axes 2/3). `E` = lock the contact nearest the crosshair, `V` = chase / first-person view, `1`–`5` = Classify / Track / Monitor / Escalate / Ignore. Both sticks are on-screen (mouse or touch) and combine with keyboard and gamepad.

**What the 3D world changes in the simulation**
- The drone *is* the sensor platform: range and bearing to every contact are measured from where you fly, so you must position yourself.
- The crosshair is the EO/IR boresight: keeping it on a contact boosts EO/IR and counts as attending it.
- Line of sight is real: buildings (urban/night/mixed/degraded) and terrain ridges (border/mixed) block EO/IR and degrade radar. The scripted "occlusion" events still fire on top of this.
- You collide with buildings/structures, cannot go under terrain and are kept inside the world bounds.

**Worlds:** Urban = dusk city grid with towers, lit windows, street lights; Border = mountains, valleys, treeline, observation tower, fence line; Night = stars, moon, dark urban/rural boundary, beacon towers, thermal view on the Thermal tab; Swarm = golden-hour open farmland with sheds and power poles; Degraded = industrial site in dense fog (stacks, tanks, rotating radar dish); Mixed = city edge + ridge + tower, dusk turning to night with rain mid-mission.

**Known limits (honest):** the world is a stylised synthetic training space, not a map of a real place; the five sensor-feed tabs are schematic displays (EO/IR/Thermal are projected from the 3D camera, Radar/RF/Acoustic are instrument views); Replay still reconstructs the session as a 2D scene with contacts and sensor state, not a 3D flythrough; if the browser has no WebGL the app falls back to the flat 2D scene so it never shows a blank screen.
