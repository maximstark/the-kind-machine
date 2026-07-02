// Frame burst: skip the cold open, start a walk, capture frames to judge motion.
// Usage: node tools/burst.mjs [outPrefix] [frames] [gapMs]
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const prefix = process.argv[2] ?? 'shots/burst'
const frames = parseInt(process.argv[3] ?? '5', 10)
const gap = parseInt(process.argv[4] ?? '260', 10)
mkdirSync('shots', { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
await page.goto(process.env.TKM_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.mouse.click(195, 420)
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(400)
  const st = await page.evaluate(() => window.__tkm.game.state)
  if (st === 'cold-open') await page.evaluate(() => window.__tkm.tapClient(195, 420))
  if (st === 'explore') break
}
await page.waitForTimeout(1200)
// Start a diagonal walk across the frame, then a turn.
await page.evaluate(() => window.__tkm.tapWorld(4, 0, 1))
await page.waitForTimeout(900)
for (let i = 0; i < frames; i++) {
  await page.screenshot({ path: `${prefix}-${i}.png`, clip: { x: 60, y: 250, width: 270, height: 340 } })
  if (i === Math.floor(frames / 2)) {
    await page.evaluate(() => window.__tkm.tapWorld(-2, 0, 5)) // turn
  }
  await page.waitForTimeout(gap)
}
await browser.close()
console.log('burst done')
