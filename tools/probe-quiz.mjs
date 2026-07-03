// Capture the quiz respond moment: answer a question, screenshot the reply.
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
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(350)
  const st = await page.evaluate(() => window.__tkm.game.state)
  if (st === 'cold-open') await page.evaluate(() => window.__tkm.tapClient(195, 420))
  if (st === 'explore') break
}
// Two examines, then the mark.
for (const id of ['field-torch', 'field-silhouette']) {
  for (let i = 0; i < 2; i++) {
    await page.evaluate((eid) => {
      const g = window.__tkm.game
      const a = g.scene.anchors.get(eid)
      const obj = a ? a.object : g.scene.plainExamines.find((p) => p.id === eid)?.object
      const b = new window.__tkm.THREE.Box3().setFromObject(obj)
      const c = b.getCenter(new window.__tkm.THREE.Vector3())
      window.__tkm.tapWorld(c.x, c.y, c.z)
    }, id)
    await page.waitForTimeout(i === 0 ? 4500 : 1200)
  }
}
await page.evaluate(() => {
  const wm = window.__tkm.game.scene.waymark
  window.__tkm.tapWorld(wm.x, 0, wm.z + 2)
})
await page.waitForTimeout(4500)
await page.evaluate(() => {
  const wm = window.__tkm.game.scene.waymark
  window.__tkm.tapWorld(wm.x, wm.y, wm.z)
})
// Wait for cards, answer, screenshot the respond beat.
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(400)
  if (await page.evaluate(() => window.__tkm.quiz.currentPhase === 'cards')) break
}
const first = await page.evaluate(() => window.__tkm.game.overlay.cardRects[0]?.id)
const rect = await page.evaluate((l) => window.__tkm.game.overlay.cardRects.find((c) => c.id === l), first)
const rt = await page.evaluate(() => ({ w: window.__tkm.game.pipeline.rtWidth, h: window.__tkm.game.pipeline.rtHeight }))
await page.mouse.click(((rect.x + rect.w / 2) / rt.w) * 390, ((rect.y + rect.h / 2) / rt.h) * 844)
await page.waitForTimeout(2200)
await page.screenshot({ path: 'shots/p5-quiz-respond.png' })
await browser.close()
console.log('quiz respond captured')
