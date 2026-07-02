# STATUS

## P2 pass (post-playtest, July 2)
Addressing Maxim's first-playthrough notes:
- **Legibility**: machine text 16px, captions 13px, brighter green, heavier plates, tap-to-hurry text (pinned questions only complete, never dismiss).
- **Premise**: skippable cold open states the situation plainly over black (world ended, you were kept, the last day is being rebuilt); only the cause and the blame stay withheld.
- **Goal clarity**: waymark now gates behind 2 examines (or 75s) and announces itself when it opens; post-quiz re-entry line invites you to look again; tapping the mark from afar walks you to it.
- **Character**: fully articulated procedural figure — spring-lagged hem/sleeves, hood brim + cuff trims, counter-bobbing head with attention glances (soft guidance), lean/roll, idle breathing, footfall thuds + ash puffs.
- **World**: ARCHIVIST bust waits at every mark and the render smears locally around it; dead trees + ruin skyline + dropped bundle (field); collapsed beam, banners, graves, rubble (chapel); dropped torches, rubble, dark windows (tower); pale floor runner, fallen columns, candle banks (hall); falling ash motes everywhere.
- **Green hardening**: machine green requires the UI pixel itself to be green-dominant — pale UI over warm surfaces can no longer leak green into the world.
- Verified: both ending playthroughs pass; draw calls 30/44/45/42 (<50); build 200KB gz. Tower/chapel are near budget — merge character parts if a future scene needs headroom.

# Overnight build (July 2, 2026)

**TL;DR: the complete skeleton is playable, start to both endings.** Title → Field → Chapel → Tower → Door → choice → outro → title. Every system from the scope doc is wired against real data. It is ugly in the places predicted (graybox dressing, DRAFT lines) and — I'd argue — already beautiful in the places that matter (the pipeline, the dissolve, the beam).

`npm run dev` and play on a phone-shaped window; `npm run build` passes.

## Done (all seven milestones)
1. **Pixel/dither pipeline** — 360px RT, nearest upscale, 4×4 Bayer (spread 0.34), 5-color palette, perceptual quantize, shader vignette. Machine green is shader-gated to UI pixels: it cannot appear in the world. All UI (text/cards) drawn at RT resolution inside the pipeline, so everything dithers together and can smear together.
2. **Grid + tap-to-move + examine + ledger.** Plausibly-seen logging (dwell + frustum + proximity), examines, per-scene lie/mutation/honest assignment, quiz records, flourish snapshots. The ledger is the game; everything downstream reads it.
3. **Ink dissolve + quiz + machine voice + trust.** Typewriter voice with per-char tick events, touch cards, three-source response logic, hidden trust meter, re-entry rewrites (agree with a lie → the world redraws to the machine's version and stays that way).
4. **Corruption layer.** Row smear + channel bleed + luminance drag, pre-quantize. Fed by a neutral `beat` bus (multiple emitters) + its own slow clock; per-scene escalation 0.015 → 0.05 → 0.11 → 0.18; fully clears only in the accept ending (`becalm`). Nothing in code/comments/debug attributes it to one source.
5. **All four scenes + both endings.** Chapel (first lie + first mutation, chalk mark, glyph wall), Tower (false-hint puzzle — the machine swaps cross/wave; follow it twice and the door forgives you; personal quiz), Door (the monumental hall on the screen diagonal: pullback 14→31 view-width as you walk, colonnade, ceiling masses, god-beam with flicker, gold-framed door; the assembly reads YOUR ledger back — chalk mark seen or avoided, what you carried, hint-following, agreement rate; choice; accept = bright/clean/becalmed, keep = scratched/heavier; final thank-you line; ink-out).
6. **Audio + flourish.** Synth drone (detuned saws + noise + LFO) that darkens with the weather, voice tick grains, chimes, ink-scratch on dissolves, unlock on title tap, visibilitychange pause. Flourish: prefetch at walk-phase start, 4s abort, one-sentence gate, scripted fallback, entry + post-quiz slots. Dev stub serves canned lines; `proxy/` holds the real Hono service skeleton (env key only, CORS TODO, not deployed).
7. **Verification** — all automated, headless:
   - `node tools/playthrough.mjs keep` → trust −0.47 (defiant), resisted lie, true glyph order, keep ending. PASSES.
   - `node tools/playthrough.mjs accept` → trust +1.0 (deferent), followed false hint (recorded), agreed with lie (world redrawn), accept ending. PASSES.
   - `node tools/verify-perf.mjs` → 16/24/23/27 draw calls per scene (<50 budget).
   - Screenshots in `shots/` — see `pt-keep-hall.png` (the monumental shot) and `pt-accept-ending.png` (absolution).

## Stubbed / placeholder
- All machine lines are `// DRAFT` — the voice pass is yours (script.ts, scene files, proxy/index.ts system prompt).
- Flourish endpoint = Vite middleware with canned lines. Real integration = deploy `proxy/`, point the client at it. Contract already matches.
- All art is procedural graybox with `TODO(maxim)` intent: title card, ARCHIVIST avatar, ending illustration per §7c are untouched, as instructed.
- Trust-flavored mid-game lines: only the post-quiz lines vary by band so far; the 2–3 scene-entry variants are unwritten.

## Known rough edges (fix-forward list)
- Ground-plane edges visible as dark corners at some spawn angles (reads vignette-ish; enlarge planes or add edge fade).
- Machine text pacing: holds feel long for fast readers; consider tap-to-skip-reveal.
- Chapel/Tower spawn framing is serviceable, not composed; Field and Door are the strong ones.
- No real-device test yet — iOS Safari audio unlock and Threads in-app browser are implemented-to-spec but unverified on hardware (doc says test Day 2; that's a your-phone job).
- Quiz respond-phase shows dimmed stale cards (visual only).
- Second playthrough = page reload (deliberate; clean state).

## What I'd do next (in order)
1. Your voice pass over every DRAFT line (the machine currently over-explains in places; it should say less).
2. Phone-in-hand playtest: lie subtlety + mutation trigger timing (the two things only playtesting tunes, per §9).
3. Threads in-app browser check.
4. Deploy proxy + real flourishes behind the existing 4s gate.
5. Hero assets (§7c): title card, avatar through the smear, ending illustration.
