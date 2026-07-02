import { CSS } from '../core/palette'
import type { Pipeline } from '../core/pipeline'

// All UI is drawn onto a canvas at render-target resolution and composited
// inside the post shader, so text and cards pass through the same dither
// pipeline as the world. Machine green exists only here.

export interface CardRect {
  id: string
  x: number
  y: number
  w: number
  h: number
}

export const FONT_MACHINE = 'Georgia, serif'
export const FONT_UI = 'Consolas, monospace'

export class Overlay {
  private ctx: CanvasRenderingContext2D
  private pipeline: Pipeline
  cardRects: CardRect[] = []

  constructor(pipeline: Pipeline) {
    this.pipeline = pipeline
    this.ctx = pipeline.uiCtx
  }

  get w() {
    return this.pipeline.rtWidth
  }
  get h() {
    return this.pipeline.rtHeight
  }

  clear() {
    this.ctx.clearRect(0, 0, this.w, this.h)
    this.cardRects = []
  }

  wrap(text: string, font: string, maxWidth: number): string[] {
    const ctx = this.ctx
    ctx.font = font
    const words = text.split(' ')
    const lines: string[] = []
    let line = ''
    for (const word of words) {
      const test = line ? line + ' ' + word : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
    if (line) lines.push(line)
    return lines
  }

  text(
    str: string,
    x: number,
    y: number,
    opts: {
      font?: string
      size?: number
      color?: string
      align?: CanvasTextAlign
      maxWidth?: number
      lineHeight?: number
      alpha?: number
    } = {}
  ): number {
    const ctx = this.ctx
    const size = opts.size ?? 12
    const font = `${size}px ${opts.font ?? FONT_UI}`
    const lines = opts.maxWidth ? this.wrap(str, font, opts.maxWidth) : [str]
    const lh = opts.lineHeight ?? size + 4
    ctx.font = font
    ctx.fillStyle = opts.color ?? CSS.bone
    ctx.textAlign = opts.align ?? 'left'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opts.alpha ?? 1
    lines.forEach((l, i) => ctx.fillText(l, x, y + i * lh))
    ctx.globalAlpha = 1
    return lines.length * lh
  }

  // Machine speech: green, centered in the lower third, serif.
  machineText(str: string, opts: { alpha?: number; yFrac?: number; size?: number } = {}) {
    const size = opts.size ?? 16
    const maxW = this.w - 40
    const font = `${size}px ${FONT_MACHINE}`
    const lines = this.wrap(str, font, maxW)
    const lh = size + 5
    const blockH = lines.length * lh
    const y = Math.round(this.h * (opts.yFrac ?? 0.68)) - blockH / 2
    const ctx = this.ctx
    ctx.globalAlpha = (opts.alpha ?? 1) * 0.78
    ctx.fillStyle = CSS.black
    ctx.fillRect(this.w / 2 - maxW / 2 - 5, y - 6, maxW + 10, blockH + 11)
    ctx.font = font
    ctx.fillStyle = CSS.green
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opts.alpha ?? 1
    lines.forEach((l, i) => ctx.fillText(l, this.w / 2, y + i * lh))
    ctx.globalAlpha = 1
  }

  // Player-side captions (examine text): bone, bottom band.
  caption(str: string, opts: { alpha?: number } = {}) {
    const size = 13
    const maxW = this.w - 34
    const font = `${size}px ${FONT_UI}`
    const lines = this.wrap(str, font, maxW)
    const lh = size + 4
    const y = this.h - 28 - lines.length * lh
    const ctx = this.ctx
    ctx.globalAlpha = (opts.alpha ?? 0.92) * 0.75
    ctx.fillStyle = CSS.black
    ctx.fillRect(this.w / 2 - maxW / 2 - 5, y - 5, maxW + 10, lines.length * lh + 9)
    ctx.font = font
    ctx.fillStyle = CSS.bone
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.globalAlpha = opts.alpha ?? 0.92
    lines.forEach((l, i) => ctx.fillText(l, this.w / 2, y + i * lh))
    ctx.globalAlpha = 1
  }

  // Touch card: the machine's interface intruding on the world.
  card(
    id: string,
    label: string,
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { selected?: boolean; alpha?: number } = {}
  ) {
    const ctx = this.ctx
    ctx.globalAlpha = opts.alpha ?? 1
    ctx.fillStyle = CSS.black
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = CSS.green
    ctx.lineWidth = opts.selected ? 2 : 1
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
    if (opts.selected) {
      ctx.fillStyle = CSS.green
      ctx.fillRect(x + 3, y + 3, w - 6, h - 6)
    }
    const size = 14
    const font = `${size}px ${FONT_MACHINE}`
    const lines = this.wrap(label, font, w - 14)
    const lh = size + 3
    ctx.font = font
    ctx.fillStyle = opts.selected ? CSS.black : CSS.green
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const cy = y + h / 2 - ((lines.length - 1) * lh) / 2
    lines.forEach((l, i) => ctx.fillText(l, x + w / 2, cy + i * lh))
    ctx.globalAlpha = 1
    this.cardRects.push({ id, x, y, w, h })
  }

  // Map a screen-space pointer position to an overlay card id, if any.
  hitCard(clientX: number, clientY: number): string | null {
    const sx = (clientX / window.innerWidth) * this.w
    const sy = (clientY / window.innerHeight) * this.h
    for (const r of this.cardRects) {
      if (sx >= r.x && sx <= r.x + r.w && sy >= r.y && sy <= r.y + r.h) return r.id
    }
    return null
  }

  vignette(strength = 0.5) {
    const ctx = this.ctx
    const g = ctx.createRadialGradient(
      this.w / 2,
      this.h / 2,
      this.h * 0.3,
      this.w / 2,
      this.h / 2,
      this.h * 0.72
    )
    g.addColorStop(0, 'rgba(19,17,24,0)')
    g.addColorStop(1, `rgba(19,17,24,${strength})`)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, this.w, this.h)
  }

  fade(alpha: number) {
    if (alpha <= 0) return
    this.ctx.fillStyle = `rgba(19,17,24,${Math.min(1, alpha)})`
    this.ctx.fillRect(0, 0, this.w, this.h)
  }
}
