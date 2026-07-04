// Verifies the §7c hero-asset ingestion path end-to-end against the dev
// server: all manifest slots load, the ARCHIVIST avatar quad mounted on the
// field bust, and the title card renders. Screenshot lands in shots/.
// Usage: node tools/verify-assets.mjs (dev server running; TKM_URL to override)
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

mkdirSync('shots', { recursive: true })
const url = process.env.TKM_URL ?? 'http://localhost:5173/'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(url, { waitUntil: 'networkidle' })
await page.waitForTimeout(800)

let failed = false
function check(label, ok) {
  console.log(`${ok ? 'ok' : 'FAIL'}  ${label}`)
  if (!ok) failed = true
}

await page.evaluate(() => window.__tkm.heroAssets.ready)

const loaded = await page.evaluate(() => ({
  title: window.__tkm.heroAssets.has('title'),
  avatar: window.__tkm.heroAssets.has('avatar'),
  ending: window.__tkm.heroAssets.has('ending'),
}))
check('title asset ingested', loaded.title)
check('avatar asset ingested', loaded.avatar)
check('ending asset ingested', loaded.ending)

// The field scene is built at boot; the bust should carry the avatar quad.
const avatarInWorld = await page.evaluate(() => {
  let found = false
  window.__tkm.game.scene.three.traverse((o) => {
    if (o.name === 'archivist-avatar') found = true
  })
  return found
})
check('avatar quad mounted on field bust', avatarInWorld)

// Title card: the card is composited via the UI canvas (readable 2D, unlike
// the WebGL canvas) — with it drawn, the frame is no longer near-uniform black.
await page.waitForTimeout(600)
await page.screenshot({ path: 'shots/assets-title.png' })
const litFraction = await page.evaluate(() => {
  const ui = window.__tkm.game.pipeline.uiCanvas
  const ctx = ui.getContext('2d')
  const d = ctx.getImageData(0, 0, ui.width, ui.height).data
  let lit = 0
  let total = 0
  for (let i = 0; i < d.length; i += 4) {
    total++
    if (d[i + 3] > 128 && d[i] + d[i + 1] + d[i + 2] > 380) lit++
  }
  return lit / total
})
check(`title card visible (lit fraction ${litFraction.toFixed(3)} > 0.03)`, litFraction > 0.03)

await browser.close()
if (errors.length) {
  console.error('PAGE ERRORS:')
  for (const e of errors) console.error(' - ' + e)
  process.exit(2)
}
process.exit(failed ? 1 : 0)
