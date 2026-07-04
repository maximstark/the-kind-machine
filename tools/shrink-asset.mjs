// Ship-encode for hero-asset PNGs: cap the long side at 1280 (the engine's
// processing cap), grayscale + posterize to 16 levels (the 1-bit threshold
// only cares about values near the cutoff; long flat runs are what PNG's
// deflate compresses), re-encode. Reports before/after bytes.
// Usage: node tools/shrink-asset.mjs <in.png> [out.png]  (in-place if no out)
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, statSync } from 'fs'
import { resolve } from 'path'

const src = process.argv[2]
if (!src) {
  console.error('usage: node tools/shrink-asset.mjs <in.png> [out.png]')
  process.exit(1)
}
const inPath = resolve(src)
const outPath = resolve(process.argv[3] ?? src)
const beforeBytes = statSync(inPath).size

const dataUrl = 'data:image/png;base64,' + readFileSync(inPath).toString('base64')

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()
const result = await page.evaluate(async (srcUrl) => {
  const MAX_SIDE = 1280
  const LEVELS = 16
  const img = new Image()
  img.src = srcUrl
  await img.decode()
  const s = Math.min(1, MAX_SIDE / Math.max(img.width, img.height))
  const w = Math.round(img.width * s)
  const h = Math.round(img.height * s)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const d = ctx.getImageData(0, 0, w, h)
  const p = d.data
  for (let i = 0; i < p.length; i += 4) {
    const lum = 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]
    const q = Math.round((Math.round((lum / 255) * (LEVELS - 1)) / (LEVELS - 1)) * 255)
    p[i] = p[i + 1] = p[i + 2] = q
    p[i + 3] = 255
  }
  ctx.putImageData(d, 0, 0)
  return c.toDataURL('image/png')
}, dataUrl)
await browser.close()

const buf = Buffer.from(result.split(',')[1], 'base64')
writeFileSync(outPath, buf)
console.log(
  `OK ${outPath}  ${(beforeBytes / 1024).toFixed(0)}KB -> ${(buf.length / 1024).toFixed(0)}KB`
)
