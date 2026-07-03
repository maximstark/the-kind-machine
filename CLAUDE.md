# CLAUDE.md — THE KIND MACHINE

An 8–12 minute mobile-first isometric psychological-horror vignette (Three.js, browser, distributed via Threads). The machine ARCHIVIST rebuilds the last day of the world and gently disputes your memory of it. Solo dev: Maxim Stark; Claude builds autonomously against the scope doc. Live: https://maximstark.github.io/the-kind-machine/

**The contract is `scope-doc-the-kind-machine.md`** — code comments reference its § numbers. `STATUS.md` = build state (update it each session). `DECISIONS.md` = one line per design call: decision + why + what to review. `notes/` is gitignored and never ships.

## Commands

```bash
npm run dev                              # dev server; flourish stub at /api/flourish (vite.config.ts middleware)
npm run build                            # tsc --noEmit + vite build (~200KB gz, single chunk — fine)
npm run shot                             # headless screenshot of dev server -> shots/ (TKM_URL env to override)
node tools/playthrough.mjs keep|accept   # automated full run to either ending — must pass before commit
node tools/verify-perf.mjs               # draw calls per scene, budget < 50 (tower/chapel near budget)
node tools/render-og.mjs tools/og-card.html public/og.png   # regenerate the OG/social card
```

All verification is headless (Playwright, `channel: 'chrome'` — nothing opens on the desktop). Other `tools/verify-*.mjs` / `probe-*.mjs` scripts exercise specific features; run the relevant one after touching that feature. Verify both playthroughs + perf before committing. Commit per milestone; pushing `main` triggers the Pages deploy (`.github/workflows/deploy.yml` builds and force-pushes `dist/` to the `gh-pages` branch).

## Non-negotiable working conventions

- **Every machine-voice line you write or edit gets a `// DRAFT` marker.** The final voice pass is Maxim's. This applies in `script.ts`, scene files, `vite.config.ts` canned lines, and the `proxy/` system prompt.
- **Never attribute the corruption layer to a single source** — not in code, comments, variable names, or debug output. It is fed by a neutral `beat` bus (multiple emitters) plus its own slow clock precisely so no correlation is learnable. It fully clears only in the accept ending (`becalm`), which should feel like a loss.
- **Machine green is UI-only.** The quantizer requires the UI pixel itself to be green-dominant; green must never appear in the world. Palette (5 colors, `core/palette.ts`): bone white, ash gray (0x7e7b72), near-black, tarnished gold, sickly green.
- **The acid test for every authored line** (scope §3): a player on either side of the real-world AI divide must feel recognized in their fear, never accused. No subtweets. Zero tech vocabulary in-world — the machine speaks like a grief counselor crossed with a cathedral, and it should say *less* than you want it to.
- **No API key in the client, ever.** The flourish endpoint contract is `POST /api/flourish {ledger} -> {line}`. Dev stub lives in `vite.config.ts`; the real Hono proxy skeleton is `proxy/` (undeployed; CORS + domain TODO before deploy). Model: Haiku (`claude-haiku-4-5-20251001`), 4s abort, one-sentence gate (≤160 chars, no brackets/newlines), scripted fallback.

## Architecture (Vite + vanilla TS + Three.js, no framework)

- **The ledger is the game** (`src/game/ledger.ts`): ground truth per detail, mutation state, what the player plausibly saw (dwell + frustum + proximity), examines, answers, machine claims. The renderer is its costume. It drives quiz responses, flourish snapshots, and the Scene-4 ending assembly, which reads the player's own record back at them.
- **Three-source doubt system** (scope §2): each scene has one authored lie, one silent world mutation, one honest exchange — *except the Field* (scene 1), which is deliberately honest to build trust first (flip a flag in `field.ts` to change). Agreeing with a lie redraws the world to the machine's version and adopts it into ground truth (`redraw`); the quiz record keeps the original truth for the ending.
- **Render pipeline** (`src/core/pipeline.ts`): everything renders to a 360px-wide RT (`RT_WIDTH`), then one composite pass: smear → ink dissolve → UI overlay → 4×4 Bayer dither (spread 0.34) + palette quantize. Smear/dissolve run pre-quantize. **All UI is drawn in-pipeline** at RT resolution (2D canvas composited in the shader), so text dithers and smears with the world.
- **State machine** lives in `src/game/game.ts` (~900 lines, the hub): scene flow title → field → chapel → tower → door → choice → outro. Scenes in `src/game/scenes/` (+ `kit.ts` shared dressing, all placeholder graybox pending §7c hero assets).
- **Camera** (`src/core/isoCamera.ts`): ortho at 45°/~30°; north (−z) projects up-RIGHT on screen; scenes are composed along the screen diagonal with per-scene `camBias`. The hall's pullback is dynamic: view width 14 → 31 via `viewWidthAt` as you walk.
- **Trust** (`src/game/trust.ts`): hidden meter, adjusts on answers/hint-follows; selects ending flavor + post-quiz line bands. No visible UI, ever.
- **Audio** (`src/audio/sound.ts`): all synthesized (detuned-saw drone that darkens with the weather, voice tick grains, chimes, ink-scratch). Unlock on title tap; `visibilitychange` pause.
- **Character** (`src/game/character.ts`): procedurally animated primitives (springs, lag, attention glances that double as diegetic guidance); tuning constants at the top of the file.
- Desktop gets a letterboxed portrait frame + WASD/space (P3); the game is composed for a phone in portrait.

## Design rules that override cleverness

- Suggestion outperforms detail at 360px — never let silhouettes (ceiling masses, the bust) resolve.
- Awe is a camera setting; it costs nothing.
- The game must remain 100% complete with scripted lines alone — AI flourishes flavor, never carry (cut-safety guarantee, scope §6).
- Pre-committed cut list, in order (scope §8): flourishes → scripted-only; Tower puzzle → single door; ending illustration → palette-shifted title card; audio → drone only.

## Open scope (as of July 3, 2026 — check STATUS.md/git log for drift)

1. **Voice pass over all `// DRAFT` lines** (~110 across script.ts, scene files, vite stub, proxy prompt) — Maxim's job by design.
2. **Hero ink assets (scope §7c), all untouched:** title card (doubles as Threads launch image, Maxim's hand), ARCHIVIST avatar through the smear (replaces placeholder bust), ending illustration, stretch glyph set. `TODO(maxim)` marks the seams.
3. **Deploy `proxy/`** (Coolify VPS behind Cloudflare planned) and point the client at it; contract already matches the stub.
4. **Real-device tests:** iOS Safari audio unlock + Threads in-app browser are implemented-to-spec but unverified on hardware.
5. **Phone-in-hand playtest** for lie subtlety and mutation timing — the two things only playtesting tunes (scope §9).
6. **Trust-flavored scene-entry line variants** (2–3) unwritten; only post-quiz lines vary by band.
7. **Launch post** (Day 7): title card + 15s capture of the ink dissolve.

STATUS.md's "known rough edges" list has the minor fix-forward items (P3–P5 passes addressed text pacing, desktop, legibility, onboarding — see git log).
