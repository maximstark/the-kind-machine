// Draw-call audit per scene (<50/scene per the scope doc).
import { chromium } from 'playwright'

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
await page.waitForTimeout(3000)

for (const id of ['field', 'chapel', 'tower', 'door']) {
  if (id !== 'field') {
    await page.evaluate((s) => window.__tkm.jumpTo(s), id)
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(400)
      if ((await page.evaluate(() => window.__tkm.game.state)) === 'explore') break
    }
  }
  const info = await page.evaluate(() => window.__tkm.game.pipeline.lastSceneStats)
  console.log(`${id}: ${info.calls} draw calls, ${info.triangles} triangles`)
}
await browser.close()
