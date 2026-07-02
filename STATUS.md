# STATUS — overnight build

Updated as systems land. Read DECISIONS.md alongside this.

## Done
- **M1: Pixel/dither pipeline + iso camera + scaffold.** 360px RT, nearest upscale, 4×4 Bayer (spread 0.34), 5-color palette, perceptual quantization, shader vignette, UI-gated machine green, in-pipeline canvas UI. Judge gate passed (`shots/m1-final.png`).
- **M2: Grid/movement/examine/ledger.** BFS pathfinding, walk-then-examine queue, dwell+frustum plausibly-seen logging, role assignment (lie/mutation/honest), quiz records, flourish snapshot.
- **M3: Quiz + machine voice + trust + dissolve.** Touch cards in-pipeline, per-char typewriter with tick events, three-source response logic, hidden trust meter, re-entry rewrite (agreeing with a lie redraws the world to the machine's version — and the ledger adopts it).
- **M4: Corruption layer.** Row-smear + channel bleed + luminance drag, pre-quantize; fed by a neutral `beat` bus (multiple emitters) + its own slow clock; per-scene baseline escalation 0.015 → 0.05 → 0.11 → 0.18; UI smears too above 0.35 amplitude; `becalm()` for the accept ending.
- **M5: All four scenes; both endings reachable.**
  - Field (tutorial, honest), Chapel (first lie + first mutation; chalk mark; glyph wall = Tower key), Tower (false-hint glyph puzzle — machine swaps cross/wave; personal quiz; only the beacon can truly mutate), Door (monumental hall: colonnade, ceiling masses, god-beam; assembly of the account from the ledger; choice; accept = world clears/brightens, keep = stays scratched; final line; ink-out to title).
  - Automated full playthroughs pass for BOTH endings (`tools/playthrough.mjs keep|accept`): trust bands land correctly (-0.57 defiant / +1.0 deferent), hint-follows recorded, 9 quiz records.

## In progress
- M6: audio drone + text tick + flourish slot prefetch.

## Stubbed
- `/api/flourish` = Vite dev middleware, canned DRAFT lines + 0.5–2.1s latency. Client integration lands in M6; `proxy/` Hono skeleton to be added (no key, unwired).

## Broken / known-rough
- Chapel/Tower spawn corners show ground-plane edge as dark void (reads vignette-ish; cheap fix later: bigger planes or edge fade).
- Player pawn nearly invisible at hall zoom (intentional smallness, but a blob shadow would help).
- Quiz respond-phase leaves dimmed stale cards clickable-looking (visual only; taps ignored).
- Machine text hold times feel long when reading fast — pacing pass wanted.

## Next
- M6 (audio + flourish stub wiring), M7 (Scene 4 monumental polish + final playthroughs), then STATUS final pass.

## How to verify
- `npm run dev` then `node tools/playthrough.mjs keep` / `accept` (needs Chrome; headless).
- Screenshots land in `shots/`.
