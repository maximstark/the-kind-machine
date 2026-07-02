// Probe: skip cold open, jump to a scene, report state + camera + screenshot.
import { chromium } from 'playwright'

const target = process.argv[2] ?? 'tower'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.mouse.click(195, 420)
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(350)
  const st = await page.evaluate(() => window.__tkm.game.state)
  if (st === 'cold-open') await page.evaluate(() => window.__tkm.tapClient(195, 420))
  if (st === 'explore') break
}
await page.evaluate((t) => window.__tkm.jumpTo(t), target)
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(400)
  const st = await page.evaluate(() => window.__tkm.game.state)
  if (st === 'explore') break
}
await page.waitForTimeout(1500)
const info = await page.evaluate(() => ({
  state: window.__tkm.game.state,
  scene: window.__tkm.game.scene.id,
  cam: window.__tkm.game.rig.getCenter(),
  player: window.__tkm.game.player.object.position,
  calls: window.__tkm.game.pipeline.lastSceneStats,
}))
console.log(JSON.stringify(info, null, 1))
await page.screenshot({ path: `shots/probe-${target}.png` })
await browser.close()
