// Threshold sweep for hero-asset ingestion tuning: renders a candidate
// image at eleven 1-bit cutoffs (0.25–0.75) so the right manifest value in
// src/game/heroAssets.ts can be picked by eye.
// Standalone: node tools/probe-threshold.mjs <image.png> [out.png]
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { basename, resolve } from 'path'

const src = process.argv[2]
if (!src) {
  console.error('usage: node tools/probe-threshold.mjs <image.png> [out.png]')
  process.exit(1)
}
const name = basename(src).replace(/\.[^.]+$/, '')
const out = resolve(process.argv[3] ?? `shots/threshold-${name}.png`)
mkdirSync('shots', { recursive: true })

const dataUrl = 'data:image/png;base64,' + readFileSync(resolve(src)).toString('base64')

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()

const result = await page.evaluate(async (srcUrl) => {
  const img = new Image()
  img.src = srcUrl
  await img.decode()
  const TILE_W = 300
  const scale = TILE_W / img.width
  const tw = TILE_W
  const th = Math.round(img.height * scale)
  const COLS = 4
  const thresholds = Array.from({ length: 11 }, (_, i) => 0.25 + i * 0.05)
  const rows = Math.ceil(thresholds.length / COLS)
  const PAD = 14
  const LABEL = 22
  const sheet = document.createElement('canvas')
  sheet.width = PAD + COLS * (tw + PAD)
  sheet.height = PAD + rows * (th + LABEL + PAD)
  const g = sheet.getContext('2d')
  g.fillStyle = '#131118'
  g.fillRect(0, 0, sheet.width, sheet.height)

  const work = document.createElement('canvas')
  work.width = tw
  work.height = th
  const wg = work.getContext('2d')

  thresholds.forEach((thr, i) => {
    wg.clearRect(0, 0, tw, th)
    wg.drawImage(img, 0, 0, tw, th)
    const d = wg.getImageData(0, 0, tw, th)
    const p = d.data
    for (let j = 0; j < p.length; j += 4) {
      const lum = (0.2126 * p[j] + 0.7152 * p[j + 1] + 0.0722 * p[j + 2]) / 255
      const on = lum >= thr && p[j + 3] > 127
      p[j] = p[j + 1] = 232
      p[j + 2] = 201
      p[j + 3] = on ? 255 : 0
    }
    wg.putImageData(d, 0, 0)
    const x = PAD + (i % COLS) * (tw + PAD)
    const y = PAD + Math.floor(i / COLS) * (th + LABEL + PAD)
    g.drawImage(work, x, y)
    g.strokeStyle = 'rgba(126,123,114,0.4)'
    g.strokeRect(x + 0.5, y + 0.5, tw - 1, th - 1)
    g.fillStyle = '#7e7b72'
    g.font = '14px Consolas, monospace'
    g.textAlign = 'center'
    g.fillText(`threshold ${thr.toFixed(2)}`, x + tw / 2, y + th + 16)
  })
  return sheet.toDataURL('image/png')
}, dataUrl)

await browser.close()
writeFileSync(out, Buffer.from(result.split(',')[1], 'base64'))
console.log('OK ' + out)
