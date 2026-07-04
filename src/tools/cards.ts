import { heroAssets } from '../game/heroAssets'
import { CSS } from '../core/palette'
import { quantize } from './quantize'

// Card isolation renders — dev tool, never shipped (dev-only /cards.html;
// the build's sole entry is index.html). Renders the hero-asset slots
// exactly as the pipeline shows them, minus the type, as editing bases:
//   title          the full 4:5 card at in-game pixel density, bone at
//                  0.9 alpha over black (the gold-speckled title look)
//   ending-accept  the epitaph illustration, gold and clean
//   ending-keep    the same image, bone, crossed out and scratched
// Nearest-upscaled so the dither texture survives round trips.

const RT_H = 779 // canonical portrait phone (390x844) render-target height

function renderCard(
  w: number,
  h: number,
  upscale: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): string {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#131118'
  ctx.fillRect(0, 0, w, h)
  draw(ctx)
  ctx.putImageData(quantize(ctx.getImageData(0, 0, w, h)), 0, 0)
  const up = document.createElement('canvas')
  up.width = w * upscale
  up.height = h * upscale
  const ug = up.getContext('2d')!
  ug.imageSmoothingEnabled = false
  ug.drawImage(c, 0, 0, up.width, up.height)
  document.body.appendChild(up)
  return up.toDataURL('image/png')
}

async function build() {
  await heroAssets.ready
  const out: Record<string, string> = {}

  const title = heroAssets.tinted('title', CSS.bone)
  if (title) {
    // In-game the card cover-fits the RT, so its on-screen pixel density is
    // rtH / cardH — render the full frame at that density, uncropped.
    const s = RT_H / title.height
    const w = Math.round(title.width * s)
    const h = Math.round(title.height * s)
    out['title'] = renderCard(w, h, 2, (ctx) => {
      ctx.globalAlpha = 0.9
      ctx.drawImage(title, 0, 0, w, h)
      ctx.globalAlpha = 1
    })
  }

  for (const kind of ['accept', 'keep'] as const) {
    const accent = kind === 'accept' ? CSS.gold : CSS.bone
    const ill = heroAssets.tinted('ending', accent)
    if (!ill) continue
    const w = 360
    const h = Math.round((ill.height * w) / ill.width)
    // The epitaph draws this ~150px wide; the keep treatment's strokes
    // scale with the render so the look holds at reference size.
    const k = w / 150
    out[`ending-${kind}`] = renderCard(w, h, 4, (ctx) => {
      ctx.drawImage(ill, 0, 0, w, h)
      if (kind === 'keep') {
        // Mirrors the epitaph's dry-brushed crossing-out, scaled.
        ctx.strokeStyle = accent
        const passes: [number, number, number, number][] = [
          [0, 0, 3, 1],
          [2, -1.5, 1.5, 0.75],
          [-2, 1.5, 1, 0.5],
        ]
        for (const [ox, oy, lw, a] of passes) {
          ctx.globalAlpha = a
          ctx.lineWidth = lw * k
          ctx.beginPath()
          ctx.moveTo((-10 + ox) * k, h + oy * k)
          ctx.lineTo(w + (10 + ox) * k, oy * k)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
        ctx.globalAlpha = 0.4
        ctx.fillStyle = CSS.ash
        for (let i = 0; i < 7; i++) {
          const yy = 8 * k + (i * (h - 16 * k)) / 6 + Math.sin(i * 7) * 3 * k
          ctx.fillRect(-14 * k + (i % 3) * 10 * k, yy, (22 + (i % 2) * 16) * k, 1.5 * k)
        }
        ctx.globalAlpha = 1
      }
    })
  }

  ;(window as any).__cards = out
  ;(window as any).__cardsStatus = 'done'
}

;(window as any).__cardsStatus = 'rendering'
build()
