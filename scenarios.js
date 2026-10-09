/* AEROSHIELD scenario library — pure data + scene builders (no DOM access).
   The Training Engine (engine.js) consumes these configurations; nothing scenario-specific is hard-coded in the UI.
   Everything here is a SYNTHETIC TRAINING definition. No real-world targeting or weapon-control functionality. */
(function (g) {
  'use strict';
  const NS = g.AeroShield = g.AeroShield || {};

  const SENSORS = ['radar', 'eoir', 'rf', 'acoustic'];
  const SENSOR_LABEL = { radar: 'RADAR', eoir: 'EO/IR', rf: 'RF ANALYSIS', acoustic: 'ACOUSTIC' };

  // ---- Difficulty actually drives the simulation (counts, speed, event rate, sensors, confidence, decision pressure) ----
  const DIFFICULTY = {
    'Medium':    { level: 1, countMul: 1.0,  speedMul: 1.0,  eventMul: 1.0,  sensorRel: 1.0,  confGain: 1.0,  windowMul: 1.0,  pressureBase: 30 },
    'High':      { level: 2, countMul: 1.15, speedMul: 1.15, eventMul: 0.85, sensorRel: 0.93, confGain: 0.9,  windowMul: 0.88, pressureBase: 42 },
    'Very High': { level: 3, countMul: 1.3,  speedMul: 1.3,  eventMul: 0.7,  sensorRel: 0.87, confGain: 0.82, windowMul: 0.78, pressureBase: 56 },
    'Extreme':   { level: 4, countMul: 1.4,  speedMul: 1.4,  eventMul: 0.6,  sensorRel: 0.82, confGain: 0.75, windowMul: 0.7,  pressureBase: 64 }
  };

  // ---- Metric catalogue (scenario scoring weights reference these ids) ----
  const METRICS = {
    detection:       { label: 'Detection',              short: 'DET', legacy: 'detection' },
    classification:  { label: 'Classification',         short: 'CLS', legacy: 'classification' },
    tracking:        { label: 'Tracking',               short: 'TRK', legacy: 'tracking' },
    sensorFusion:    { label: 'Sensor Fusion',          short: 'FUS', legacy: 'sensorFusion' },
    awareness:       { label: 'Situational Awareness',  short: 'AWR', legacy: 'awareness' },
    response:        { label: 'Response Timing',        short: 'RSP', legacy: 'response' },
    prioritization:  { label: 'Prioritization',         short: 'PRI', legacy: 'prioritization' },
    decisionQuality: { label: 'Decision Quality',       short: 'DQ',  legacy: 'decision' },
    confidenceMgmt:  { label: 'Confidence Management',  short: 'CNF', legacy: 'confidenceMgmt' },
    falsePositive:   { label: 'False-Positive Handling',short: 'FPH', legacy: 'falsePositive' }
  };

  // ---- Synthetic contact type library. truth: what the contact really is (hidden from the trainee). ----
  // vis = per-sensor detectability multiplier. kmh = speed range in km/h. alt = altitude range in metres.
  const TYPES = {
    quad:     { label: 'Small quadcopter',   truth: 'drone',   size: 'Small',  kmh: [28, 55],  alt: [40, 160],  vis: { radar: .85, eoir: 1,   rf: 1,   acoustic: 1   } },
    fixed:    { label: 'Fixed-wing UAS',     truth: 'drone',   size: 'Medium', kmh: [60, 110], alt: [90, 320],  vis: { radar: 1,   eoir: 1,   rf: .8,  acoustic: .65 } },
    micro:    { label: 'Micro drone',        truth: 'drone',   size: 'Tiny',   kmh: [8, 24],   alt: [20, 90],   vis: { radar: .35, eoir: .85, rf: .7,  acoustic: .5  } },
    unknown:  { label: 'Unknown contact',    truth: 'drone',   size: 'Small',  kmh: [30, 70],  alt: [60, 280],  vis: { radar: .8,  eoir: .8,  rf: .45, acoustic: .45 }, hidden: true },
    benign:   { label: 'Unknown contact',    truth: 'clutter', size: 'Small',  kmh: [20, 55],  alt: [60, 240],  vis: { radar: .8,  eoir: .9,  rf: 0,   acoustic: .1  }, hidden: true },
    bird:     { label: 'Bird / wildlife',    truth: 'clutter', size: 'Small',  kmh: [14, 40],  alt: [20, 140],  vis: { radar: .5,  eoir: .9,  rf: 0,   acoustic: .1  } },
    ghost:    { label: 'Urban clutter echo', truth: 'clutter', size: 'Tiny',   kmh: [0, 6],    alt: [10, 60],   vis: { radar: .9,  eoir: 0,   rf: 0,   acoustic: 0   } }
  };

  // ---- Scenario definitions ----
  const SCENARIOS = {
    urban: {
      id: 'urban', name: 'Urban Perimeter', card: { tag: 'Single Drone', env: 'Urban', time: 'Evening', adverse: false, img: 'scenario-urban.jpg' },
      environment: 'Dense Urban City', terrain: 'Buildings, roads, rooftops, towers', time: 'Evening / Dusk', weather: 'Clear', visibility: 'Restricted between structures',
      theme: 'urban', scene: 'urban', fieldKm: 4, moveScale: 0.026, durationSec: 210, defaultTab: 'EO/IR',
      threatProfile: 'Single & small-group drones between buildings', threatShort: 'Single / Small-Group Drones',
      difficulty: 'Medium',
      contactCount: { initial: [2, 4], max: 6 },
      contactTypes: { quad: 4.5, fixed: 1, micro: 1, bird: 1.6, ghost: 2.4 },
      spawnPattern: { startAfter: 14, every: [15, 21], size: [1, 2], entry: 'interior', groupChance: .25, stagger: [0, 7] },
      movementPattern: { quad: 'weave', fixed: 'transit', micro: 'creep', bird: 'drift', ghost: 'ghost' },
      sensorProfile: {
        radar:    { conf: 70, noise: .30, range: 5.2, pDetect: .84, label: 'CLUTTER' },
        eoir:     { conf: 78, noise: .12, range: 3.9, pDetect: .78, label: 'PARTIAL BLOCK', blockP: .32 },
        rf:       { conf: 56, noise: .30, range: 3.6, pDetect: .56, label: 'INTERMITTENT', intermittent: .16 },
        acoustic: { conf: 36, noise: .58, range: 1.9, pDetect: .40, label: 'NOISY' }
      },
      sensorDegradation: { radar: { noiseAdd: .05 }, acoustic: { noiseAdd: .1 } },
      eventPool: [
        { id: 'u-occlude-1', type: 'occlude', at: [20, 30], dur: [7, 10], cause: 'building', label: 'Contact disappears behind building' },
        { id: 'u-fp-1',      type: 'falsePositive', at: [38, 52], dur: [11, 14], label: 'False-positive sensor event: clutter echo mimics a drone track' },
        { id: 'u-cross-1',   type: 'crossPaths', at: [58, 72], dur: [8, 10], label: 'Multiple contacts briefly cross paths' },
        { id: 'u-occlude-2', type: 'occlude', at: [84, 100], dur: [6, 9], cause: 'building', label: 'Contact passes behind rooftop structure' },
        { id: 'u-fp-2',      type: 'falsePositive', every: [40, 55], startAt: 118, dur: [10, 13], label: 'Urban clutter triggers another false positive' },
        { id: 'u-rfloss',    type: 'sensorMod', sensor: 'rf', mod: 'drop', at: [66, 90], dur: [10, 14], label: 'RF intermittent between buildings' }
      ],
      objectives: [
        { id: 'o1', kind: 'classCorrect', target: 3, text: 'Correctly classify 3 contacts' },
        { id: 'o2', kind: 'maxFalseEsc', target: 1, text: 'Keep false escalations to 1 or fewer' },
        { id: 'o3', kind: 'reacquire', target: 1, text: 'Re-acquire a contact after it passes behind a building' }
      ],
      objectiveText: 'Classify urban contacts while minimizing false positives.',
      scoringWeights: { classification: .35, tracking: .25, awareness: .20, response: .20 },
      aarMetrics: ['classification', 'falsePositive', 'tracking', 'response'],
      thresholds: { classify: 68, fusionNeeded: 2, attendWindow: 42, responseTarget: 15, detectTarget: 8 },
      briefing: 'Dusk over a dense city. Small drones pop up between buildings while rooftop clutter, birds and radar echoes generate false contacts. Build a classification before you act, and do not escalate clutter.',
      coach: 'Wait for EO/IR plus a second sensor before committing; clutter echoes are radar-only.'
    },

    border: {
      id: 'border', name: 'Border Surveillance', card: { tag: 'Multiple', env: 'Rural', time: 'Day', adverse: false, img: 'scenario-border.jpg' },
      environment: 'Mountainous Border Terrain', terrain: 'Valleys, ridgelines, observation tower', time: 'Day', weather: 'Clear', visibility: 'Long-range, terrain-limited',
      theme: 'border', scene: 'border', fieldKm: 22, moveScale: 0.0125, durationSec: 240, defaultTab: 'Radar',
      threatProfile: 'Low-frequency distant contacts, long-range movement', threatShort: 'Distant Long-Range Contacts',
      difficulty: 'High',
      contactCount: { initial: [1, 3], max: 5 },
      contactTypes: { fixed: 3, quad: 1.6, unknown: 3, benign: 1.2, bird: 1.4 },
      spawnPattern: { startAfter: 26, every: [26, 36], size: [1, 1], entry: 'edge', groupChance: 0, stagger: [0, 12] },
      movementPattern: { fixed: 'transit', quad: 'transit', unknown: 'transit', benign: 'drift', bird: 'drift' },
      sensorProfile: {
        radar:    { conf: 90, noise: .08, range: 24, pDetect: .92, label: 'LONG RANGE' },
        eoir:     { conf: 82, noise: .10, range: 13, pDetect: .76, label: 'TERRAIN MASK', blockP: .12, delayFarSec: 9 },
        rf:       { conf: 50, noise: .22, range: 12, pDetect: .45, label: 'INTERMITTENT', intermittent: .2 },
        acoustic: { conf: 22, noise: .45, range: 2.2, pDetect: .12, label: 'WEAK' }
      },
      sensorDegradation: {},
      eventPool: [
        { id: 'b-enter-1',  type: 'spawn', at: [10, 16], entry: 'edge', kinds: ['fixed'], count: 1, label: 'Distant contact enters radar coverage' },
        { id: 'b-mask-1',   type: 'occlude', at: [34, 46], dur: [10, 14], cause: 'terrain', label: 'Contact moves behind mountain terrain' },
        { id: 'b-eodelay',  type: 'delayEO', at: [24, 36], dur: [14, 18], label: 'EO/IR confirmation delayed at long range' },
        { id: 'b-second',   type: 'spawn', at: [64, 82], entry: 'edgeOpposite', kinds: ['unknown', 'quad'], count: 1, label: 'Second contact appears from another direction' },
        { id: 'b-mask-2',   type: 'occlude', at: [112, 130], dur: [9, 13], cause: 'terrain', label: 'Terrain masking drops a contact behind a ridge' },
        { id: 'b-rf',       type: 'sensorMod', sensor: 'rf', mod: 'drop', at: [90, 110], dur: [14, 20], label: 'RF returns intermittent at range' }
      ],
      objectives: [
        { id: 'o1', kind: 'earlyDetect', target: 2, text: 'Detect 2 contacts before they close inside the near field' },
        { id: 'o2', kind: 'noPremature', target: 1, text: 'Make at most 1 premature classification' },
        { id: 'o3', kind: 'reacquire', target: 1, text: 'Maintain track continuity through terrain masking' }
      ],
      objectiveText: 'Detect and maintain long-range track continuity.',
      scoringWeights: { detection: .35, tracking: .30, classification: .20, response: .15 },
      aarMetrics: ['detection', 'tracking', 'confidenceMgmt', 'classification'],
      thresholds: { classify: 70, fusionNeeded: 2, attendWindow: 55, responseTarget: 26, detectTarget: 5 },
      briefing: 'Clear day on a mountain border. Contacts are distant and slow; radar sees them first and EO/IR confirms late. Track early, build confidence, and do not classify before the evidence supports it.',
      coach: 'Track as soon as radar picks up a contact, then wait for EO/IR confirmation before classifying.'
    },

    night: {
      id: 'night', name: 'Night Infiltration', card: { tag: 'Multiple', env: 'Night', time: 'Low Visibility', adverse: true, img: 'scenario-night.jpg' },
      environment: 'Dark Urban / Rural Boundary', terrain: 'Towers, structures, treeline', time: 'Night', weather: 'Clear, Low Visibility', visibility: 'Minimal lighting',
      theme: 'night', scene: 'night', fieldKm: 3.6, moveScale: 0.02, durationSec: 220, defaultTab: 'Thermal',
      threatProfile: 'Small low-observable drones, slow, intermittent', threatShort: 'Low-Observable Small Drones',
      difficulty: 'High',
      contactCount: { initial: [2, 4], max: 5 },
      contactTypes: { micro: 5, quad: 2.2, unknown: 1.2, ghost: 1.6, bird: .8 },
      spawnPattern: { startAfter: 18, every: [18, 26], size: [1, 1], entry: 'interior', groupChance: 0, stagger: [2, 10], blink: true },
      movementPattern: { micro: 'creep', quad: 'creep', unknown: 'creep', ghost: 'ghost', bird: 'drift' },
      sensorProfile: {
        radar:    { conf: 52, noise: .32, range: 4.6, pDetect: .5, label: 'LOW RCS' },
        eoir:     { conf: 86, noise: .10, range: 4.8, pDetect: .88, label: 'THERMAL PRIMARY', thermal: true },
        rf:       { conf: 46, noise: .25, range: 3.8, pDetect: .42, label: 'INTERMITTENT', intermittent: .22 },
        acoustic: { conf: 28, noise: .5, range: 1.5, pDetect: .3, label: 'DEGRADED' }
      },
      sensorDegradation: { acoustic: { noiseAdd: .1 } },
      eventPool: [
        { id: 'n-brief',   type: 'blink', at: [12, 18], dur: [3, 4], label: 'Contact appears briefly and fades' },
        { id: 'n-thermal', type: 'thermal', at: [28, 38], dur: [12, 16], label: 'Thermal signature detected' },
        { id: 'n-radar',   type: 'sensorMod', sensor: 'radar', mod: 'drop', at: [46, 58], dur: [14, 18], confMul: .55, label: 'Radar confidence drops on small object' },
        { id: 'n-rf',      type: 'sensorMod', sensor: 'rf', mod: 'outage', at: [66, 78], dur: [14, 20], label: 'RF signal disappears' },
        { id: 'n-reappear',type: 'occlude', at: [92, 106], dur: [8, 11], cause: 'darkness', reappearElsewhere: true, label: 'Contact fades from view' },
        { id: 'n-fp',      type: 'falsePositive', every: [44, 58], startAt: 120, dur: [10, 13], label: 'Thermal false positive from warm structure' }
      ],
      objectives: [
        { id: 'o1', kind: 'fusionDecisions', target: 3, text: 'Make 3 decisions backed by 2+ correlated sensors' },
        { id: 'o2', kind: 'maxFalseEsc', target: 1, text: 'Keep false positives to 1 or fewer' },
        { id: 'o3', kind: 'reacquire', target: 1, text: 'Re-acquire a contact that reappears from another direction' }
      ],
      objectiveText: 'Correlate low-visibility sensor evidence.',
      scoringWeights: { detection: .30, sensorFusion: .30, classification: .25, response: .15 },
      aarMetrics: ['detection', 'sensorFusion', 'falsePositive', 'response'],
      thresholds: { classify: 66, fusionNeeded: 2, attendWindow: 46, responseTarget: 18, detectTarget: 8 },
      briefing: 'Night, minimal lighting. Contacts are small and slow; radar sees little. EO/IR thermal is your primary sensor. Use the sensor cursor to slew EO/IR and correlate before classifying.',
      coach: 'Point the sensor cursor at faint contacts to improve thermal returns, then correlate with RF/radar.'
    },

    swarm: {
      id: 'swarm', name: 'Swarm Attack', card: { tag: 'Swarm', env: 'Open Terrain', time: 'Day', adverse: false, img: 'scenario-swarm.jpg' },
      environment: 'Open / Semi-Urban Field', terrain: 'Wide observation area, low structures', time: 'Late Afternoon', weather: 'Clear', visibility: 'Wide area, high activity',
      theme: 'swarm', scene: 'swarm', fieldKm: 9, moveScale: 0.021, durationSec: 210, defaultTab: 'Radar',
      threatProfile: 'Many simultaneous grouped contacts', threatShort: 'Multi-Contact Swarm',
      difficulty: 'Very High',
      contactCount: { initial: [8, 12], max: 15 },
      contactTypes: { quad: 5, micro: 2, fixed: 1.2, bird: .8, ghost: .5 },
      spawnPattern: { startAfter: 22, every: [16, 22], size: [3, 5], entry: 'edge', groupChance: 1, stagger: [0, 5], flock: true },
      movementPattern: { quad: 'flock', micro: 'flock', fixed: 'flock', bird: 'drift', ghost: 'ghost' },
      sensorProfile: {
        radar:    { conf: 60, noise: .40, range: 10, pDetect: .72, label: 'OVERLOAD RISK' },
        eoir:     { conf: 70, noise: .20, range: 5.5, pDetect: .66, label: 'MULTI-TARGET' },
        rf:       { conf: 54, noise: .46, range: 6.5, pDetect: .66, label: 'OVERLAPPING' },
        acoustic: { conf: 32, noise: .62, range: 3.2, pDetect: .45, label: 'NOISY' }
      },
      sensorDegradation: { radar: { noiseAdd: .08 }, rf: { noiseAdd: .08 } },
      eventPool: [
        { id: 's-expand',  type: 'swarmExpand', at: [24, 34], count: [3, 4], label: 'Swarm expansion: new contacts spawn' },
        { id: 's-merge',   type: 'merge', at: [44, 56], dur: [7, 9], label: 'Two contacts merge visually' },
        { id: 's-lose',    type: 'contactLoss', at: [62, 72], dur: [8, 11], label: 'Contact disappears from tracking' },
        { id: 's-outside', type: 'spawn', at: [78, 90], entry: 'edge', kinds: ['quad', 'micro'], count: 2, label: 'New contacts appear from outside the observation area' },
        { id: 's-over',    type: 'sensorMod', sensor: 'radar', mod: 'overload', at: [96, 110], dur: [14, 18], label: 'Sensor overload: radar saturated' },
        { id: 's-dir',     type: 'dirChange', at: [124, 138], label: 'Sudden swarm direction change' },
        { id: 's-expand2', type: 'swarmExpand', every: [30, 40], startAt: 150, count: [2, 3], label: 'Swarm expansion: additional group enters' }
      ],
      objectives: [
        { id: 'o1', kind: 'attendedFrac', target: 60, text: 'Keep 60% or more of active contacts attended' },
        { id: 'o2', kind: 'goodPriority', target: 4, text: 'Handle 4 contacts in correct priority order' },
        { id: 'o3', kind: 'maxMissed', target: 4, text: 'Allow no more than 4 missed detections' }
      ],
      objectiveText: 'Maintain situational awareness across multiple contacts.',
      scoringWeights: { awareness: .35, prioritization: .30, tracking: .20, response: .15 },
      aarMetrics: ['awareness', 'prioritization', 'tracking', 'detection', 'response'],
      thresholds: { classify: 56, fusionNeeded: 2, attendWindow: 60, responseTarget: 11, detectTarget: 7 },
      briefing: 'Simulated multi-contact scenario. 8 to 15 contacts move in groups with overlapping tracks. Sensors saturate. Use the priority tags (P1 closest/fastest) to decide what to handle first; you will not be able to attend everything.',
      coach: 'Work the P1 tags first, track groups rather than individuals, and do not over-invest in one contact.'
    },

    degraded: {
      id: 'degraded', name: 'Degraded Sensors', card: { tag: 'Single', env: 'Rural', time: 'Low Visibility', adverse: true, img: 'scenario-fog.jpg' },
      environment: 'Rural / Industrial Site', terrain: 'Stacks, radar tower, low structures', time: 'Morning', weather: 'Fog / Interference', visibility: 'Reduced, noisy',
      theme: 'degraded', scene: 'degraded', fieldKm: 6, moveScale: 0.021, durationSec: 220, defaultTab: 'EO/IR',
      threatProfile: 'Normal contact count, unreliable sensors', threatShort: 'Normal Count / Sensor Failures',
      difficulty: 'High',
      contactCount: { initial: [2, 4], max: 5 },
      contactTypes: { quad: 3, fixed: 1.6, unknown: 1.6, bird: 1.2, ghost: 1 },
      spawnPattern: { startAfter: 22, every: [22, 30], size: [1, 1], entry: 'interior', groupChance: 0, stagger: [0, 8] },
      movementPattern: { quad: 'erratic', fixed: 'transit', unknown: 'erratic', bird: 'drift', ghost: 'ghost' },
      sensorProfile: {
        radar:    { conf: 62, noise: .30, range: 7, pDetect: .70, label: 'INTERMITTENT', intermittent: .22 },
        eoir:     { conf: 41, noise: .55, range: 3.8, pDetect: .55, label: 'NOISY' },
        rf:       { conf: 50, noise: .3, range: 5, pDetect: .5, label: 'BLACKOUT', baseOffline: 26, intermittent: .25 },
        acoustic: { conf: 33, noise: .5, range: 2.2, pDetect: .3, label: 'LOW CONFIDENCE' }
      },
      sensorDegradation: { radar: { noiseAdd: .06 } },
      eventPool: [
        { id: 'd-radar',    type: 'sensorMod', sensor: 'radar', mod: 'outage', at: [30, 40], dur: [14, 18], label: 'Radar outage' },
        { id: 'd-eo',       type: 'sensorMod', sensor: 'eoir', mod: 'drop', at: [54, 64], dur: [16, 20], confMul: .6, noiseAdd: .2, label: 'EO/IR degradation' },
        { id: 'd-conflict', type: 'conflict', at: [74, 86], dur: [14, 18], label: 'Conflicting sensor readings on a contact' },
        { id: 'd-rf',       type: 'sensorMod', sensor: 'rf', mod: 'outage', at: [100, 112], dur: [18, 24], label: 'RF blackout' },
        { id: 'd-recover',  type: 'recover', at: [128, 140], label: 'Sensor recovery: radar and EO/IR restored' },
        { id: 'd-conflict2',type: 'conflict', every: [36, 48], startAt: 150, dur: [12, 16], label: 'Another sensor conflict' }
      ],
      objectives: [
        { id: 'o1', kind: 'outageDecisions', target: 2, text: 'Make 2 correct decisions while a sensor is offline' },
        { id: 'o2', kind: 'noPremature', target: 2, text: 'Keep premature classifications to 2 or fewer' },
        { id: 'o3', kind: 'calibration', target: 60, text: 'Keep confidence management at 60% or higher' }
      ],
      objectiveText: 'Make sound decisions under incomplete sensor information.',
      scoringWeights: { sensorFusion: .35, decisionQuality: .30, confidenceMgmt: .20, response: .15 },
      aarMetrics: ['sensorFusion', 'decisionQuality', 'confidenceMgmt', 'response'],
      thresholds: { classify: 58, fusionNeeded: 2, attendWindow: 44, responseTarget: 20, detectTarget: 10 },
      briefing: 'Fog and interference. Radar is intermittent, EO/IR is noisy, RF starts blacked out and acoustic is unreliable. Sensors fail and recover during the mission. Correlate partial evidence and match your commitment to your confidence.',
      coach: 'When a sensor drops, hold with Monitor/Track instead of classifying on a single source.'
    },

    mixed: {
      id: 'mixed', name: 'Mixed Threats', card: { tag: 'Multiple', env: 'Night', time: 'Rain', adverse: true, img: 'scenario-rain.jpg' },
      environment: 'Mixed Urban + Rural Terrain', terrain: 'City edge, tower, open ground, ridge', time: 'Dusk → Night', weather: 'Clear → Rain', startTime: 'Dusk', startWeather: 'Clear', visibility: 'Variable',
      theme: 'mixed', scene: 'mixed', fieldKm: 10, moveScale: 0.013, durationSec: 270, defaultTab: 'EO/IR',
      threatProfile: 'Single, multiple, unknown and swarm-like groups', threatShort: 'Single + Multi + Unknown + Group',
      difficulty: 'Extreme',
      contactCount: { initial: [4, 6], max: 10 },
      contactTypes: { quad: 3, fixed: 1.6, micro: 1.6, unknown: 2, benign: .9, bird: 1, ghost: 1.2 },
      spawnPattern: { startAfter: 16, every: [15, 21], size: [1, 3], entry: 'mixed', groupChance: .35, stagger: [0, 9], flock: true },
      movementPattern: { quad: 'weave', fixed: 'transit', micro: 'creep', unknown: 'transit', benign: 'drift', bird: 'drift', ghost: 'ghost' },
      sensorProfile: {
        radar:    { conf: 76, noise: .24, range: 14, pDetect: .8, label: 'NOMINAL' },
        eoir:     { conf: 72, noise: .18, range: 8.5, pDetect: .72, label: 'NOMINAL', blockP: .15 },
        rf:       { conf: 58, noise: .3, range: 9, pDetect: .58, label: 'INTERMITTENT', intermittent: .14 },
        acoustic: { conf: 40, noise: .5, range: 3.2, pDetect: .36, label: 'NOISY' }
      },
      sensorDegradation: {},
      eventPool: [
        { id: 'm-single',   type: 'spawn', at: [8, 14], entry: 'edge', kinds: ['fixed', 'quad'], count: 1, label: 'Single contact enters the area' },
        { id: 'm-multi',    type: 'spawn', at: [26, 36], entry: 'mixed', kinds: ['quad', 'micro', 'unknown'], count: 3, label: 'Multiple contacts appear' },
        { id: 'm-conflict', type: 'conflict', at: [44, 56], dur: [12, 16], label: 'Sensor conflict: EO/IR and RF disagree' },
        { id: 'm-fp',       type: 'falsePositive', at: [62, 74], dur: [11, 14], label: 'False positive: clutter mimics a drone' },
        { id: 'm-loss',     type: 'occlude', at: [84, 98], dur: [8, 12], cause: 'building', label: 'Contact disappears behind structure' },
        { id: 'm-env',      type: 'envChange', at: [108, 122], label: 'Environment change: dusk to night with rain onset' },
        { id: 'm-multi2',   type: 'multi', at: [138, 152], dur: [14, 18], label: 'Multi-condition event: occlusion, RF loss and new contacts' },
        { id: 'm-swarmlike',type: 'swarmExpand', at: [170, 184], count: [3, 4], label: 'Swarm-like grouping enters from the ridge' },
        { id: 'm-fp2',      type: 'falsePositive', every: [40, 52], startAt: 196, dur: [10, 13], label: 'Another false positive in rain clutter' }
      ],
      objectives: [
        { id: 'o1', kind: 'classCorrect', target: 4, text: 'Correctly classify 4 contacts' },
        { id: 'o2', kind: 'attendedFrac', target: 55, text: 'Keep 55% or more of active contacts attended' },
        { id: 'o3', kind: 'readiness', target: 70, text: 'Reach an overall readiness score of 70 or higher' }
      ],
      objectiveText: 'Demonstrate complete adaptive threat recognition capability.',
      scoringWeights: { detection: .125, classification: .125, tracking: .125, sensorFusion: .125, awareness: .125, response: .125, decisionQuality: .125, prioritization: .125 },
      aarMetrics: ['detection', 'classification', 'tracking', 'decisionQuality', 'awareness', 'sensorFusion', 'response', 'prioritization'],
      thresholds: { classify: 56, fusionNeeded: 2, attendWindow: 42, responseTarget: 14, detectTarget: 7 },
      briefing: 'Urban edge to open ground, dusk turning to rain and night. Singles, groups, unknowns and clutter arrive together while sensors conflict and the environment changes. This is the full-capability test.',
      coach: 'Triage by priority tag, correlate before committing, and re-check your assumptions after an environment change.'
    }
  };

  const ORDER = ['urban', 'border', 'night', 'swarm', 'degraded', 'mixed'];

  // Validate configs at load so a malformed scenario can never silently reach the UI.
  const REQUIRED = ['id', 'name', 'environment', 'terrain', 'time', 'weather', 'visibility', 'threatProfile', 'contactCount', 'contactTypes', 'spawnPattern', 'movementPattern', 'sensorProfile', 'sensorDegradation', 'eventPool', 'objectives', 'difficulty', 'scoringWeights', 'briefing', 'aarMetrics'];
  function validate() {
    const problems = [];
    for (const id of ORDER) {
      const c = SCENARIOS[id];
      if (!c) { problems.push('missing scenario ' + id); continue; }
      for (const k of REQUIRED) if (c[k] === undefined) problems.push(id + ': missing ' + k);
      if (!DIFFICULTY[c.difficulty]) problems.push(id + ': unknown difficulty ' + c.difficulty);
      const sum = Object.values(c.scoringWeights).reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1) > 0.001) problems.push(id + ': scoring weights sum to ' + sum);
      for (const m of Object.keys(c.scoringWeights)) if (!METRICS[m]) problems.push(id + ': unknown metric ' + m);
      for (const m of c.aarMetrics) if (!METRICS[m]) problems.push(id + ': unknown aar metric ' + m);
      for (const t of Object.keys(c.contactTypes)) if (!TYPES[t]) problems.push(id + ': unknown contact type ' + t);
      for (const s of SENSORS) if (!c.sensorProfile[s]) problems.push(id + ': missing sensor ' + s);
    }
    return problems;
  }

  // ---------------- Scene builders (generated SVG; used for the battlefield and the replay stage) ----------------
  function rng32(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const f1 = n => Math.round(n * 10) / 10;

  function skyDefs(id, stops) {
    return `<linearGradient id="sky-${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(s => `<stop offset="${s[0]}" stop-color="${s[1]}"/>`).join('')}</linearGradient>`;
  }
  function buildings(r, n, yBase, hMin, hMax, fill, lit, opts) {
    opts = opts || {};
    let out = '', x = opts.x0 == null ? -10 : opts.x0;
    const x1 = opts.x1 == null ? 1010 : opts.x1;
    while (x < x1 && n-- > 0) {
      const w = 28 + r() * 54, h = hMin + r() * (hMax - hMin);
      out += `<rect x="${f1(x)}" y="${f1(yBase - h)}" width="${f1(w)}" height="${f1(h + 2)}" fill="${fill}"/>`;
      if (r() < .3) out += `<rect x="${f1(x + w / 2 - 1)}" y="${f1(yBase - h - 22)}" width="2" height="22" fill="${fill}"/>`;
      if (lit) {
        for (let wy = yBase - h + 8; wy < yBase - 6; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) {
          if (r() < lit.p) out += `<rect x="${f1(wx)}" y="${f1(wy)}" width="4" height="5" fill="${lit.colors[Math.floor(r() * lit.colors.length)]}" opacity="${f1(.5 + r() * .5)}"/>`;
        }
      }
      x += w + 3 + r() * 6;
    }
    return out;
  }
  function mountain(r, yBase, peakMin, peakMax, fill, snow) {
    let pts = `0,${yBase} `, x = 0;
    while (x < 1000) { const px = x + 60 + r() * 90, py = yBase - (peakMin + r() * (peakMax - peakMin)); pts += `${f1(px)},${f1(py)} `; x = px + 40 + r() * 90; pts += `${f1(x)},${f1(yBase - (peakMin * .35) * r())} `; }
    pts += `1000,${yBase} 1000,400 0,400`;
    return `<polygon points="${pts}" fill="${fill}"/>`;
  }
  function rangeRings(fieldKm) {
    // sensor site at (50%,94%) in battlefield space; rings drawn in viewBox units (1000x400)
    const cx = 500, cy = 376; let out = '';
    [.25, .5, .75, 1].forEach((k, i) => { const rx = 376 * k, ry = 376 * k; out += `<ellipse cx="${cx}" cy="${cy}" rx="${f1(rx)}" ry="${f1(ry)}" fill="none" stroke="rgba(120,220,255,.16)" stroke-width="1" stroke-dasharray="${i === 3 ? '0' : '4 6'}"/><text x="${f1(cx + rx * .72)}" y="${f1(cy - ry * .72)}" fill="rgba(140,230,255,.5)" font-size="10" font-family="monospace">${f1(fieldKm * k)} km</text>`; });
    out += `<g stroke="rgba(120,220,255,.14)" stroke-width="1"><line x1="500" y1="376" x2="500" y2="0"/><line x1="500" y1="376" x2="0" y2="120"/><line x1="500" y1="376" x2="1000" y2="120"/></g>`;
    out += `<circle cx="500" cy="376" r="5" fill="#2df0bd"/><text x="512" y="392" fill="#2df0bd" font-size="9" font-family="monospace">SENSOR SITE</text>`;
    return out;
  }

  function sceneSVG(kind, fieldKm) {
    const r = rng32(kind.split('').reduce((a, c) => a * 31 + c.charCodeAt(0), 7));
    let defs = '', body = '';
    if (kind === 'urban') {
      defs = skyDefs(kind, [[0, '#1b2a54'], [.45, '#8a4f6e'], [.75, '#e98b57'], [1, '#f6c07a']]);
      body += `<rect width="1000" height="400" fill="url(#sky-${kind})"/>`;
      body += `<circle cx="760" cy="250" r="34" fill="#ffd9a0" opacity=".55"/>`;
      body += buildings(r, 40, 330, 60, 170, '#2a2236', { p: .22, colors: ['#ffd27a', '#ffb867'] });
      body += buildings(r, 40, 372, 40, 150, '#171424', { p: .32, colors: ['#ffd27a', '#ffe9b0', '#9fe3ff'] });
      body += `<polygon points="470,372 530,372 640,400 360,400" fill="#0c0b14"/><g stroke="#ffcf7a" stroke-width="2" opacity=".6"><line x1="500" y1="376" x2="500" y2="384"/><line x1="500" y1="388" x2="500" y2="400"/></g>`;
      body += buildings(r, 12, 400, 30, 90, '#0a0910', null, { x0: -20, x1: 300 }) + buildings(r, 12, 400, 30, 90, '#0a0910', null, { x0: 700, x1: 1020 });
    } else if (kind === 'border') {
      defs = skyDefs(kind, [[0, '#3f86c9'], [.6, '#9cc9ec'], [1, '#e9f3fa']]);
      body += `<rect width="1000" height="400" fill="url(#sky-${kind})"/>`;
      body += `<circle cx="180" cy="70" r="26" fill="#fff6d8" opacity=".9"/>`;
      body += mountain(r, 300, 90, 190, '#7f93ad') + mountain(r, 340, 70, 150, '#566e5a') + mountain(r, 380, 40, 100, '#3b4f35');
      body += `<polygon points="0,400 0,350 250,336 500,352 760,334 1000,350 1000,400" fill="#6b7a45"/>`;
      body += `<polygon points="0,400 0,380 300,372 650,382 1000,370 1000,400" fill="#4c5c30"/>`;
      body += `<g fill="#2a2f27"><rect x="858" y="214" width="14" height="150"/><rect x="842" y="196" width="46" height="26"/><polygon points="836,196 894,196 865,176" fill="#3a3f35"/><rect x="848" y="226" width="34" height="3" fill="#6a705f"/></g><rect x="853" y="203" width="6" height="8" fill="#ffd27a"/>`;
    } else if (kind === 'night') {
      defs = skyDefs(kind, [[0, '#02060d'], [.6, '#0c2036'], [1, '#1b3a57']]);
      body += `<rect width="1000" height="400" fill="url(#sky-${kind})"/>`;
      for (let i = 0; i < 70; i++) body += `<circle cx="${f1(r() * 1000)}" cy="${f1(r() * 210)}" r="${f1(.4 + r() * .9)}" fill="#cfe6ff" opacity="${f1(.25 + r() * .6)}"/>`;
      body += `<circle cx="820" cy="64" r="16" fill="#dfe8f3" opacity=".7"/>`;
      body += buildings(r, 22, 340, 40, 120, '#16293d', { p: .09, colors: ['#ffb54a'] }, { x0: 380, x1: 1010 });
      let trees = ''; for (let x = -10; x < 400; x += 14 + r() * 16) { const h = 40 + r() * 70; trees += `<polygon points="${f1(x)},350 ${f1(x + 14)},${f1(350 - h)} ${f1(x + 28)},350" fill="#10202f"/>`; }
      body += trees + `<rect x="0" y="348" width="1000" height="52" fill="#0a1622"/>`;
      body += `<g fill="#1f3850"><rect x="610" y="150" width="9" height="200"/><rect x="590" y="170" width="49" height="5"/></g><circle cx="614" cy="147" r="3.5" fill="#ff3b3b"/>`;
    } else if (kind === 'swarm') {
      defs = skyDefs(kind, [[0, '#254a86'], [.6, '#d8895c'], [1, '#f0c27c']]);
      body += `<rect width="1000" height="400" fill="url(#sky-${kind})"/>`;
      body += `<polygon points="0,400 0,300 1000,290 1000,400" fill="#55613a"/>`;
      body += `<polygon points="0,400 0,340 500,328 1000,340 1000,400" fill="#3e4a2b"/>`;
      body += buildings(r, 26, 296, 14, 52, '#2a2438', { p: .1, colors: ['#ffd27a'] }, { x0: 40, x1: 960 });
      body += `<g stroke="rgba(255,255,255,.07)" stroke-width="1">${Array.from({ length: 9 }, (_, i) => `<line x1="${i * 125}" y1="0" x2="${i * 125}" y2="400"/>`).join('')}${Array.from({ length: 4 }, (_, i) => `<line x1="0" y1="${i * 100}" x2="1000" y2="${i * 100}"/>`).join('')}</g>`;
    } else if (kind === 'degraded') {
      defs = skyDefs(kind, [[0, '#6c7b88'], [.55, '#8d9aa4'], [1, '#aab4bb']]);
      body += `<rect width="1000" height="400" fill="url(#sky-${kind})"/>`;
      body += `<polygon points="0,400 0,320 1000,312 1000,400" fill="#47515a"/>`;
      let stacks = '';
      [[110, 120], [150, 90], [240, 130], [760, 110], [800, 80], [880, 120]].forEach(([x, h]) => { stacks += `<rect x="${x}" y="${330 - h}" width="16" height="${h}" fill="#2d343a"/><rect x="${x - 2}" y="${330 - h}" width="20" height="6" fill="#3a434b"/><ellipse cx="${x + 8}" cy="${330 - h - 8}" rx="20" ry="9" fill="#cdd5da" opacity=".5"/>`; });
      body += stacks + buildings(r, 14, 340, 14, 46, '#232a30', null, { x0: 280, x1: 740 });
      body += `<g fill="#1e2429"><rect x="502" y="170" width="8" height="170"/><ellipse cx="506" cy="168" rx="46" ry="14" fill="#2a3138"/><rect x="498" y="150" width="16" height="20"/></g>`;
      body += `<rect width="1000" height="400" fill="#c5ced4" opacity=".28"/><rect y="250" width="1000" height="120" fill="#d7dee3" opacity=".18"/>`;
    } else { // mixed
      defs = skyDefs(kind, [[0, '#0e1a33'], [.55, '#4a3a63'], [1, '#c4775a']]);
      body += `<rect width="1000" height="400" fill="url(#sky-${kind})"/>`;
      body += mountain(r, 330, 80, 170, '#2b3550');
      body += buildings(r, 20, 350, 60, 170, '#1b1a2c', { p: .26, colors: ['#ffd27a', '#9fe3ff'] }, { x0: -10, x1: 440 });
      body += `<polygon points="400,400 400,352 700,344 1000,356 1000,400" fill="#2f3a2a"/>`;
      body += `<g fill="#16192a"><rect x="830" y="196" width="12" height="150"/><rect x="814" y="182" width="44" height="22"/><polygon points="808,182 864,182 836,164"/></g><circle cx="836" cy="190" r="3" fill="#ff5b5b"/>`;
      body += `<rect y="352" width="1000" height="48" fill="#0b0c18"/>`;
    }
    return `<svg class="sceneSvg" viewBox="0 0 1000 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs>${defs}</defs>${body}${rangeRings(fieldKm)}</svg>`;
  }

  Object.assign(NS, { SENSORS, SENSOR_LABEL, DIFFICULTY, METRICS, TYPES, SCENARIOS, ORDER, sceneSVG, validate, rng32 });
  if (typeof module !== 'undefined' && module.exports) module.exports = NS;
})(typeof window !== 'undefined' ? window : globalThis);
