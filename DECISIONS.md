# DECISIONS — overnight build log

One line each: decision + why + what to review.

- **Local git only, no remote.** Commit-early rule needs a repo; no remote was specified. Review: push target.
- **Flourish stub = Vite dev middleware at `/api/flourish`.** Keeps `npm run dev` one command while matching the real proxy's HTTP contract exactly; `proxy/` holds the unwired Hono skeleton. Review: contract shape before real integration.
- **All UI drawn in-pipeline** (2D canvas at RT resolution, composited in the post shader pre-quantization). Text, cards, captions all inherit the dither/palette and can be smeared by the corruption layer; machine green is shader-gated to UI pixels only, so it can never appear in the world. Review: text legibility on a real phone.
- **Linear fog calibrated to camera distance** (near/far as offsets from the iso rig distance) instead of exp2 — exp2 at iso distances crushed everything to black. Review: none, it's a graybox-visible win.
- **Dither spread 0.34** after trying 0.2 (flat slabs) and 0.5 (uniform noise). This is the "gradients read as crosshatch, fills stay quiet" middle. Review: judge on phone screen.
- **Palette ash retuned** from 0x77705f (warm olive — dithered to brown mud against black) to 0x7e7b72 (neutral). Review: against your reference set.
- **Machine text = Georgia serif, player captions = Consolas mono**, both with dark backing plates. Serif-through-dither reads "cathedral"; mono reads "record". Review: font choice is yours to veto.
- **Character = primitive robed figure** (cone + bone head sphere), not billboard sprite — reads well at 360px, zero art dependency. Review: §6 allowed either; swap to sprite later if you prefer.
- **Screenshot verification via Playwright (channel: chrome, headless)** — `npm run shot`. Nothing opens on your desktop.
