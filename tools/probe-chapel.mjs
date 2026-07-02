// Chapel gate diagnosis: examine twice, dump ledger + gate state each step.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(800)
await page.mouse.click(195, 420)
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(350)
  const st = await page.evaluate(() => window.__tkm.game.state)
  if (st === 'cold-open') await page.evaluate(() => window.__tkm.tapClient(195, 420))
  if (st === 'explore') break
}
await page.evaluate(() => window.__tkm.jumpTo('chapel'))
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(400)
  if ((await page.evaluate(() => window.__tkm.game.state)) === 'explore') break
}

const dump = () =>
  page.evaluate(() => ({
    state: window.__tkm.game.state,
    player: {
      x: +window.__tkm.game.player.object.position.x.toFixed(1),
      z: +window.__tkm.game.player.object.position.z.toFixed(1),
    },
    examines: window.__tkm.ledger.examines.map((e) => `${e.sceneId}:${e.targetId}`),
  }))

for (const id of ['chapel-glyphs', 'chapel-mark']) {
  for (let i = 0; i < 2; i++) {
    await page.evaluate((eid) => {
      const g = window.__tkm.game
      const a = g.scene.anchors.get(eid)
      const obj = a ? a.object : g.scene.plainExamines.find((p) => p.id === eid)?.object
      const b = new window.__tkm.THREE.Box3().setFromObject(obj)
      const c = b.getCenter(new window.__tkm.THREE.Vector3())
      window.__tkm.tapWorld(c.x, c.y, c.z)
    }, id)
    await page.waitForTimeout(i === 0 ? 5000 : 1500)
    console.log(id, i, JSON.stringify(await dump()))
  }
}

// Try the waymark.
await page.evaluate(() => {
  const wm = window.__tkm.game.scene.waymark
  window.__tkm.tapWorld(wm.x, 0, wm.z + 2)
})
await page.waitForTimeout(5000)
await page.evaluate(() => {
  const wm = window.__tkm.game.scene.waymark
  window.__tkm.tapWorld(wm.x, wm.y, wm.z)
})
await page.waitForTimeout(3000)
console.log('after waymark:', JSON.stringify(await dump()))
if (errors.length) {
  console.error('PAGE ERRORS:')
  errors.forEach((e) => console.error(' - ' + e))
}
await browser.close()
