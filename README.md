# THE KIND MACHINE

The world has ended. A machine is reconstructing your memories of its final day — kindly, patiently, and incorrectly. You walk through what it rebuilds. It asks what you remember. It disagrees.

An 8–12 minute isometric psychological horror vignette for the phone in your hand. No jump scares. No combat. Just a narrator whose kindness never breaks, a world that changes when you aren't looking, and the growing certainty that one of you is misremembering on purpose.

**▶ [Play the demo](https://maximstark.github.io/the-kind-machine/)** — best in portrait, sound on, one sitting.

> In active development: dialogue and art are still evolving toward their final form. The bones are load-bearing; the skin comes later.

## How to play

**On a phone (the intended way):**
- **Tap the ground** to walk.
- **Tap things that glimmer** to look at them. Look carefully.
- **Tap the green mark** when you're ready to remember together.

**On a desktop:** WASD / arrow keys to walk, click to look closer, Space to hurry the text. The game keeps its portrait frame; it was composed for a hand.

Answer honestly. Or don't.

## Development

```bash
npm install
npm run dev        # dev server with a stubbed flourish endpoint
npm run build      # type-check + production bundle
npm run shot       # headless screenshot (requires Chrome)
node tools/playthrough.mjs keep|accept   # automated full playthrough to either ending
```

Vite + TypeScript + Three.js, no framework. The renderer draws to a 360px target and upscales through a single composite pass (4×4 Bayer dither, 5-color palette). All UI is drawn inside that pipeline. The AI flourish endpoint is stubbed in dev; the real proxy lives in `proxy/` and deploys separately — no API key ever ships in the client.

`STATUS.md` tracks build state; `DECISIONS.md` logs design calls made along the way.
