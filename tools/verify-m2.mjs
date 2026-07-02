// M2 verification: title -> draw-in -> explore; tap-to-move; examine; ledger dwell.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

mkdirSync('shots', { recursive: true })
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
await page.waitForTimeout(1200)

const state0 = await page.evaluate(() => window.__tkm.game.state)
console.log('state at load:', state0)

// Begin.
await page.mouse.click(195, 420)
await page.waitForTimeout(3000)
const state1 = await page.evaluate(() => window.__tkm.game.state)
console.log('state after begin + draw-in:', state1)
await page.screenshot({ path: 'shots/m2-explore.png' })

// Walk toward the torch.
await page.evaluate(() => window.__tkm.tapWorld(2.5, 0, 2.5))
await page.waitForTimeout(2500)
const pos1 = await page.evaluate(() => {
  const p = window.__tkm.game.player.object.position
  return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), cell: window.__tkm.game.player.cell }
})
console.log('player after walk:', JSON.stringify(pos1))

// Examine the torch (tap it).
await page.evaluate(() => {
  const a = window.__tkm.game.scene.anchors.get('field-torch')
  const o = a.object.position
  window.__tkm.tapWorld(o.x, 1.0, o.z)
})
await page.waitForTimeout(2600)
const led = await page.evaluate(() => {
  const L = window.__tkm.ledger
  return {
    examines: L.examines.map((e) => e.targetId),
    torchSeen: Math.round(L.seenOf('field-torch').ms),
    moonsSeen: Math.round(L.seenOf('field-moons').ms),
    stonesSeen: Math.round(L.seenOf('field-stones').ms),
    torchState: L.stateOf('field-torch'),
    assignment: L.assignments.get('field'),
  }
})
console.log('ledger:', JSON.stringify(led, null, 1))
await page.screenshot({ path: 'shots/m2-examine.png' })

// Walk far away, verify pathing around blocked cells doesn't wedge.
await page.evaluate(() => window.__tkm.tapWorld(-6, 0, 6))
await page.waitForTimeout(3200)
const pos2 = await page.evaluate(() => {
  const p = window.__tkm.game.player.object.position
  return { x: +p.x.toFixed(2), z: +p.z.toFixed(2) }
})
console.log('player after second walk:', JSON.stringify(pos2))

await browser.close()
if (errors.length) {
  console.error('PAGE ERRORS:')
  errors.forEach((e) => console.error(' - ' + e))
  process.exit(2)
}
console.log('M2 VERIFY DONE')
