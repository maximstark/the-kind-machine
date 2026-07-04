# STATUS

## P7 pass, second session (July 4 PM) — the real art landed
- **Maxim's generations are in the game.** All three §7c slots now carry his art (via notes/ drop → `src/assets/`): title card (masonry arch, beam, robed figure), ARCHIVIST avatar (classical head, hairline-seam wrongness — threshold tuned to 0.55 from the probe sweep), ending illustration (door + light path, clean source). The keep-regen with the baked-in cross was set aside — the engine draws the crossing-out itself over the single source (palette-shift architecture); the epitaph cross is now dry-brushed (3 fixed-offset passes) to sit in the art's stroke language.
- **Ship-encode**: `node tools/shrink-asset.mjs` (1280px cap + posterize-16 + re-encode) took the three PNGs 3.25MB → 353KB with no visible ingestion delta (lit-fraction parity 0.149 vs 0.150). Run it on any future generation before committing.
- **OG/social card regenerated from the real title art** (the P6 review note said to swap when it existed) — `public/og.png` is now the intended launch image.
- **Card isolation renders + prompts**: `tools/render-cards.mjs` → `notes/card-*.png` (pipeline-faithful, no type) as editing bases; ChatGPT prompt kit in `notes/imagegen-prompts.md` (attach reference render + style block; bans midtones/fake grain). This round trip is what produced the successful generations.
- **Tower glyph sculptures scaled 1.5×** for legibility (Maxim's call over a drawn set); chapel row inherits proportionally; tower probe + playthroughs pass.
- Verified post-ingestion: verify-assets, render-cards parity, perf (30/41/42/42), both playthroughs.
- Note for future sessions: never write to `src/` while a headless playthrough is running — Vite HMR reloads the page mid-run and the run fails confusingly (learned the hard way with the asset shrink).

## P7 pass (July 4) — hero-asset ingestion + character sheet
- **Maxim's playtest came back clean** (his words: the game is excellent); no fix-forward notes this round.
- **Character sprite sheet for his AI passes**: `node tools/render-character.mjs` → `notes/character-sheet.png` (dev-only /sheet.html drives the real Character class — turnaround, orthos, close-ups, plus an in-game-scale dithered pair as ground truth). Delivered July 4.
- **§7c ingestion pipeline is live end-to-end with committed placeholders**: `src/game/heroAssets.ts` crushes any PNG in `src/assets/` to a 1-bit mask at load (per-asset thresholds in its manifest; sweep-preview via `node tools/probe-threshold.mjs <file>`). Three slots wired: title card (cover-fit under the type, darkened text bands), ARCHIVIST avatar (1-bit quad replacing the bust's primitive head, billboarded, inside the existing locus smear — net −3 draw calls per scene), ending illustration on the epitaph (same image, gold/clean for accept, bone/crossed+scratched for keep; chalk-sigil fallback if the file is absent). Maxim's generations drop in by overwriting `title.png` / `avatar.png` / `ending.png`. Missing/unreadable file = procedural placeholder, zero regression.
- **Trust-flavored entry variants written** (deferent/defiant for chapel, tower, hall; wavering keeps the base line; field stays single by design — trust doesn't exist yet). All `// DRAFT`.
- **Flourish proxy hardened to config-only deploy**: origin allowlist (defaults to the live Pages domain + localhost), per-IP sliding window (40/10min), 8KB body cap, server-side one-line gate, `/healthz`. Deploy now needs only the VPS and `ANTHROPIC_API_KEY`.
- **Card isolation renders for Maxim's art passes**: `node tools/render-cards.mjs` → `notes/card-title.png` + both ending treatments, pipeline-faithful, no type — the round-trip is overwrite `src/assets/`, re-run, compare.
- **Tower glyph sculptures scaled 1.5×** for legibility (Maxim's call over generating a drawn set); chapel's foreshadowing row inherits proportionally. Tap targets re-verified via both playthroughs.
- Verified: build, both playthroughs, perf, return-visit memory, asset ingestion (`node tools/verify-assets.mjs`).

## P6 pass (July 3) — voice, memory, launch surface
- **The machine has a voice now**: wordless formant babble (the text's vowels pick the mouth shape, monotone 110Hz, falling inflection at punctuation) over a morphing vowel hum that breathes only while text reveals. Chosen from an 8-way A/B on Maxim's phone; all losing modes deleted. The old typewriter grain is gone.
- **The machine has a memory now**: `archive.ts` keeps a summary of the last completed run in localStorage (ending, trust band, lie resistance, hint follow, visit count). On a return visit: one extra cold-open line, one ending-specific field beat, and the finale thank-you gains the word "Again." Private-mode storage failures degrade silently to first-visit behavior. Verified headless: `node tools/verify-return.mjs`; playthrough asserts the run records.
- **The machine speaks, once**: the finale line is real spoken audio (scope §6 amendment) — Maxim's take through `tools/process-voice.mjs` (granular smear → ring-mod → formant EQ → crush → cathedral convolver). Keep ending gets the `default` render, accept gets `dark` (slower, octave shadow, reverse-reverb pre-echo). Shipped as 16kHz WAVs in `public/voice/` (~720KB, prefetched at hall entry, never on page load); babble mutes while it plays; missing asset degrades to babble. Playthrough asserts both renders decode.
- **Launch surface**: OG/social card (`public/og.png`, regenerable via `tools/render-og.mjs`), full OG/Twitter meta in index.html, README reworded, CLAUDE.md added for future sessions.
- Open items unchanged otherwise: voice pass over DRAFT lines, hero assets (briefs in notes/asset-briefs.md, ingestion pipeline unbuilt), proxy deploy, real-device/Threads tests, trust-flavored entry variants, launch post.

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
