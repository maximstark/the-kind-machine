// Full playthrough driver. Usage: node tools/playthrough.mjs [accept|keep]
// keep   = answer what the player saw, enter the true glyph order, keep your own account
// accept = answer what the machine claims, follow its false hint once, accept its account
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

const MODE = process.argv[2] === 'accept' ? 'accept' : 'keep'
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
await page.waitForTimeout(1000)

const state = () => page.evaluate(() => window.__tkm.game.state)
async function waitForState(target, timeoutMs = 60000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    if ((await state()) === target) return true
    await page.waitForTimeout(400)
  }
  throw new Error(`timeout waiting for state=${target} (at ${await state()})`)
}

async function tapWorld(x, y, z) {
  await page.evaluate(([a, b, c]) => window.__tkm.tapWorld(a, b, c), [x, y, z])
}

async function tapCardByLabel(label) {
  const rect = await page.evaluate(
    (l) => window.__tkm.game.overlay.cardRects.find((c) => c.id === l),
    label
  )
  if (!rect) return false
  const rt = await page.evaluate(() => ({
    w: window.__tkm.game.pipeline.rtWidth,
    h: window.__tkm.game.pipeline.rtHeight,
  }))
  await page.mouse.click(((rect.x + rect.w / 2) / rt.w) * 390, ((rect.y + rect.h / 2) / rt.h) * 844)
  return true
}

// Answer every quiz question per MODE until the game leaves the quiz state.
async function runQuiz(sceneId) {
  for (let q = 0; q < 6; q++) {
    let ready = false
    for (let i = 0; i < 100; i++) {
      await page.waitForTimeout(400)
      const st = await state()
      if (st !== 'quiz') return // quiz over
      if (await page.evaluate(() => window.__tkm.quiz.currentPhase === 'cards')) {
        ready = true
        break
      }
    }
    if (!ready) throw new Error('cards never appeared in ' + sceneId)
    const answer = await page.evaluate(
      ([mode, sid]) => {
        const L = window.__tkm.ledger
        const id = window.__tkm.quiz.currentDetailId
        const a = L.assignments.get(sid)
        if (mode === 'accept') {
          if (a.lie === id && a.lieClaim) return a.lieClaim
          return L.stateOf(id)
        }
        const seen = L.seenOf(id)
        return seen.firstState ?? L.stateOf(id)
      },
      [MODE, sceneId]
    )
    await tapCardByLabel(answer)
    console.log(`  [${sceneId}] answered: ${answer}`)
    await page.waitForTimeout(800)
  }
}

async function waymark() {
  await page.evaluate(() => {
    const wm = window.__tkm.game.scene.waymark
    window.__tkm.tapWorld(wm.x, wm.y, wm.z)
  })
}

async function walkNearWaymark() {
  await page.evaluate(() => {
    const wm = window.__tkm.game.scene.waymark
    window.__tkm.tapWorld(wm.x, 0, wm.z + 2)
  })
  await page.waitForTimeout(5000)
}

// --- begin ---
await page.mouse.click(195, 420)
await waitForState('explore')
console.log('FIELD entered')
await page.waitForTimeout(1500)

// Field: look at a couple of things, then quiz.
await tapWorld(3.5, 1.0, 2.5) // torch
await page.waitForTimeout(4500)
await walkNearWaymark()
await waymark()
await waitForState('quiz', 30000)
await runQuiz('field')
await waitForState('explore', 40000)
console.log('FIELD re-entered after quiz')
await page.waitForTimeout(1000)
await waymark() // advance
await waitForState('draw-in', 30000)
await waitForState('explore', 30000)
console.log('CHAPEL entered')
await page.screenshot({ path: `shots/pt-${MODE}-chapel.png` })

// Chapel: examine the glyph wall (needed knowledge) and the mark.
await page.evaluate(() => {
  const pe = window.__tkm.game.scene.plainExamines.find((p) => p.id === 'chapel-glyphs')
  const b = new window.__tkm.THREE.Box3().setFromObject(pe.object)
  const c = b.getCenter(new window.__tkm.THREE.Vector3())
  window.__tkm.tapWorld(c.x, c.y, c.z)
})
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const pe = window.__tkm.game.scene.plainExamines.find((p) => p.id === 'chapel-mark')
  const b = new window.__tkm.THREE.Box3().setFromObject(pe.object)
  const c = b.getCenter(new window.__tkm.THREE.Vector3())
  window.__tkm.tapWorld(c.x, c.y, c.z)
})
await page.waitForTimeout(6000)
await walkNearWaymark()
await waymark()
await waitForState('quiz', 30000)
await runQuiz('chapel')
await waitForState('explore', 40000)
console.log('CHAPEL re-entered; assignment:')
console.log(
  JSON.stringify(await page.evaluate(() => window.__tkm.ledger.assignments.get('chapel')))
)
await page.waitForTimeout(1000)
await waymark()
await waitForState('draw-in', 30000)
await waitForState('explore', 30000)
console.log('TOWER entered')
await page.screenshot({ path: `shots/pt-${MODE}-tower.png` })

// Tower: the glyph puzzle.
const trueOrder = ['circle', 'cross', 'wave', 'eye']
const hintOrder = ['circle', 'wave', 'cross', 'eye']
const orders = MODE === 'accept' ? [hintOrder, trueOrder] : [trueOrder]
async function tapGlyph(kind) {
  // First tap may only approach (stone can be off-screen); second tap,
  // now nearby and visible, examines. Repeat taps on a held stone no-op.
  for (let i = 0; i < 2; i++) {
    await page.evaluate((k) => {
      const pe = window.__tkm.game.scene.plainExamines.find((p) => p.id === 'glyph-' + k)
      const b = new window.__tkm.THREE.Box3().setFromObject(pe.object)
      const c = b.getCenter(new window.__tkm.THREE.Vector3())
      window.__tkm.tapWorld(c.x, c.y, c.z)
    }, kind)
    await page.waitForTimeout(i === 0 ? 4500 : 1500)
  }
}
for (const order of orders) {
  for (const kind of order) await tapGlyph(kind)
  const dbg = await page.evaluate(() => window.__tkm.game.scene.puzzleDebug())
  console.log(`  entered order [${order.join(',')}] ->`, JSON.stringify(dbg))
  if (dbg.solved) break
}
await walkNearWaymark()
await waymark()
await waitForState('quiz', 30000)
await runQuiz('tower')
await waitForState('explore', 40000)
console.log('TOWER re-entered')
await page.waitForTimeout(1000)
await waymark()
await waitForState('draw-in', 30000)
await waitForState('explore', 30000)
console.log('DOOR entered')
await page.screenshot({ path: `shots/pt-${MODE}-door.png` })

// The hall: walk to the beam.
await tapWorld(0, 0, -23)
await page.waitForTimeout(21000)
await page.screenshot({ path: `shots/pt-${MODE}-hall.png` })
await waymark()
await waitForState('ending', 20000)
console.log('FINALE running')

// Wait for the choice cards (the assembly takes a while).
let choiceUp = false
for (let i = 0; i < 300; i++) {
  await page.waitForTimeout(500)
  const n = await page.evaluate(() => window.__tkm.game.overlay.cardRects.length)
  if (n >= 2) {
    choiceUp = true
    break
  }
}
if (!choiceUp) throw new Error('choice never appeared')
await page.screenshot({ path: `shots/pt-${MODE}-choice.png` })
await tapCardByLabel(MODE === 'accept' ? 'Let its account stand' : 'Keep your own')
console.log('chose ending:', MODE)
await page.waitForTimeout(4000)
await page.screenshot({ path: `shots/pt-${MODE}-ending.png` })
await waitForState('outro', 40000)
await waitForState('title', 30000)
console.log('OUTRO complete, back at title')

const summary = await page.evaluate(() => ({
  trust: window.__tkm.trust.value,
  band: window.__tkm.trust.band,
  quizCount: window.__tkm.ledger.quiz.length,
  hintFollows: window.__tkm.ledger.hintFollows,
}))
console.log('SUMMARY:', JSON.stringify(summary))

await browser.close()
if (errors.length) {
  console.error('PAGE ERRORS:')
  errors.forEach((e) => console.error(' - ' + e))
  process.exit(2)
}
console.log(`PLAYTHROUGH (${MODE}) DONE`)
