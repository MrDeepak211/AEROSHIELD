# AEROSHIELD V25 — FINAL COMPLETE SIH BUILD

Standalone, dependency-free AEROSHIELD prototype for SIH26247.

## Run

Requirements: Node.js 18+

```bash
npm run dev
```

Open http://127.0.0.1:5173

No `npm install` is required. There are zero runtime npm dependencies, and there is no bundler: this is a static app served by `server.cjs`.

```bash
npm run build   # validation: syntax + every referenced asset exists + no invalid self-closing tags
npm run test:e2e # optional browser test (needs python playwright + chromium, server running)
```

## Training

1. Click **Training** or **Start Training**.
2. The mission starts immediately.
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
