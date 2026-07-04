import * as THREE from 'three'
import { PALETTE_HEX } from '../core/palette'

// §7c hero-asset ingestion. Maxim's generations drop into src/assets/ as PNG
// (dark background, single subject, values pushed to the poles — the full
// contract lives in notes/asset-briefs.md). At load each file is crushed to
// a 1-bit mask; the world only ever sees bone-or-nothing, so no generation
// can smuggle a sixth color past the palette. Missing files degrade
// silently: every slot keeps its procedural placeholder.

export type HeroKey = 'title' | 'avatar' | 'ending'

// Per-asset ingestion tuning. `threshold` is the luminance cutoff (0..1):
// pixels at or above it become ink. Features living near the cutoff flip
// unpredictably — push source values to the poles and tune here per
// generation. Preview a sweep: node tools/probe-threshold.mjs <file>.
const MANIFEST: Record<HeroKey, { file: string; threshold: number; invert?: boolean }> = {
  title: { file: 'title.png', threshold: 0.42 },
  avatar: { file: 'avatar.png', threshold: 0.45 },
  ending: { file: 'ending.png', threshold: 0.42 },
}

// Processing cap. The render target is 360px wide; source detail beyond
// this cannot survive the trip and only costs memory.
const MAX_SIDE = 1280

const files = import.meta.glob('../assets/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

interface HeroAsset {
  mask: HTMLCanvasElement // white on transparent, hard 1-bit
  w: number
  h: number
}

class HeroAssets {
  private assets = new Map<HeroKey, HeroAsset>()
  private tintCache = new Map<string, HTMLCanvasElement>()
  private textureCache = new Map<HeroKey, THREE.CanvasTexture>()
  private waiters = new Map<HeroKey, Array<() => void>>()
  readonly ready: Promise<void>

  constructor() {
    const keys = Object.keys(MANIFEST) as HeroKey[]
    this.ready = Promise.all(keys.map((k) => this.load(k))).then(() => undefined)
  }

  private async load(key: HeroKey) {
    const spec = MANIFEST[key]
    const entry = Object.entries(files).find(([path]) => path.endsWith('/' + spec.file))
    if (!entry) return // no file in the slot — placeholder art stays
    try {
      const img = new Image()
      img.src = entry[1]
      await img.decode()
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
      const w = Math.max(1, Math.round(img.width * scale))
      const h = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      const data = ctx.getImageData(0, 0, w, h)
      const d = data.data
      for (let i = 0; i < d.length; i += 4) {
        const lum = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
        let on = lum >= spec.threshold
        if (spec.invert) on = !on
        if (on && d[i + 3] > 127) {
          d[i] = d[i + 1] = d[i + 2] = 255
          d[i + 3] = 255
        } else {
          d[i + 3] = 0
        }
      }
      ctx.putImageData(data, 0, 0)
      this.assets.set(key, { mask: canvas, w, h })
      const cbs = this.waiters.get(key)
      this.waiters.delete(key)
      cbs?.forEach((cb) => cb())
    } catch {
      // Unreadable file behaves like a missing one.
    }
  }

  has(key: HeroKey): boolean {
    return this.assets.has(key)
  }

  get(key: HeroKey): HeroAsset | null {
    return this.assets.get(key) ?? null
  }

  // Runs cb once the slot's asset exists — immediately if already loaded,
  // never if the file is absent. Integration points mount through this so
  // a missing generation costs nothing.
  whenReady(key: HeroKey, cb: () => void) {
    if (this.assets.has(key)) {
      cb()
      return
    }
    const list = this.waiters.get(key) ?? []
    list.push(cb)
    this.waiters.set(key, list)
  }

  // The mask re-inked in a palette color, for the UI canvas (title card,
  // ending illustration). Cached per color.
  tinted(key: HeroKey, cssColor: string): HTMLCanvasElement | null {
    const a = this.assets.get(key)
    if (!a) return null
    const cacheKey = `${key}:${cssColor}`
    const hit = this.tintCache.get(cacheKey)
    if (hit) return hit
    const canvas = document.createElement('canvas')
    canvas.width = a.w
    canvas.height = a.h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(a.mask, 0, 0)
    ctx.globalCompositeOperation = 'source-in'
    ctx.fillStyle = cssColor
    ctx.fillRect(0, 0, a.w, a.h)
    this.tintCache.set(cacheKey, canvas)
    return canvas
  }

  // Bone-inked texture for in-world quads (the ARCHIVIST avatar). Unlit
  // bone on alpha — the world quantizer does the rest.
  worldTexture(key: HeroKey): THREE.CanvasTexture | null {
    const hit = this.textureCache.get(key)
    if (hit) return hit
    const bone = '#' + PALETTE_HEX.bone.toString(16).padStart(6, '0')
    const tintedCanvas = this.tinted(key, bone)
    if (!tintedCanvas) return null
    const tex = new THREE.CanvasTexture(tintedCanvas)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.generateMipmaps = false
    tex.colorSpace = THREE.SRGBColorSpace
    this.textureCache.set(key, tex)
    return tex
  }
}

export const heroAssets = new HeroAssets()
