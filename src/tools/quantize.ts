import * as THREE from 'three'
import { PALETTE_HEX } from '../core/palette'

// JS port of the composite shader's dither + palette step, for dev tools
// that need the shipped look outside the pipeline (sprite sheet, card
// isolation renders). Replicates the shader faithfully, including its
// comparison of display-space color against the palette as three.js stores
// it — quirks and all.

// The composite shader's Bayer matrix, indexed [x][y].
export const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
export const DITHER_SPREAD = 0.34

// World pixels quantize to the first four entries only — green is UI-only.
const PAL_WORLD = [PALETTE_HEX.bone, PALETTE_HEX.ash, PALETTE_HEX.black, PALETTE_HEX.gold].map(
  (hex) => {
    const c = new THREE.Color(hex) // converts to working space, as the pipeline does
    return [c.r, c.g, c.b]
  }
)

export function quantize(img: ImageData): ImageData {
  const d = img.data
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4
      const bay = BAYER[x % 4][y % 4] / 16
      const c = [0, 1, 2].map((k) =>
        Math.min(1, Math.max(0, d[i + k] / 255 + (bay - 0.5) * DITHER_SPREAD))
      )
      let best = Infinity
      let pick = PAL_WORLD[0]
      for (const p of PAL_WORLD) {
        const dr = c[0] - p[0]
        const dg = c[1] - p[1]
        const db = c[2] - p[2]
        const rbar = (c[0] + p[0]) * 0.5
        const dist = (2 + rbar) * dr * dr + 4 * dg * dg + (3 - rbar) * db * db
        if (dist < best) {
          best = dist
          pick = p
        }
      }
      d[i] = pick[0] * 255
      d[i + 1] = pick[1] * 255
      d[i + 2] = pick[2] * 255
      d[i + 3] = 255
    }
  }
  return img
}
