// Focused tower puzzle test: skip straight to the tower scene.
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
await page.waitForTimeout(1000)
await page.mouse.click(195, 420)
await page.waitForTimeout(3000)

// Jump straight to the tower via the debug chain.
await page.evaluate(() => window.__tkm.jumpTo('tower'))
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(400)
  if ((await page.evaluate(() => window.__tkm.game.state)) === 'explore') break
}
console.log('state:', await page.evaluate(() => window.__tkm.game.state))

for (const kind of ['wave', 'eye', 'circle', 'cross', 'eye', 'wave', 'cross', 'circle']) {
  await page.evaluate((k) => {
    const pe = window.__tkm.game.scene.plainExamines.find((p) => p.id === 'glyph-' + k)
    const b = new window.__tkm.THREE.Box3().setFromObject(pe.object)
    const c = b.getCenter(new window.__tkm.THREE.Vector3())
    window.__tkm.tapWorld(c.x, c.y, c.z)
  }, kind)
  await page.waitForTimeout(5500)
  const dbg = await page.evaluate(() => ({
    puzzle: window.__tkm.game.scene.puzzleDebug(),
    examines: window.__tkm.ledger.examines.map((e) => e.targetId),
    player: {
      x: +window.__tkm.game.player.object.position.x.toFixed(1),
      z: +window.__tkm.game.player.object.position.z.toFixed(1),
    },
  }))
  console.log(kind, '->', JSON.stringify(dbg))
}

await browser.close()
if (errors.length) {
  console.error('PAGE ERRORS:')
  errors.forEach((e) => console.error(' - ' + e))
  process.exit(2)
}

