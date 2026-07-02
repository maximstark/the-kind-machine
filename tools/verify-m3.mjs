// M3 verification: waymark -> dissolve -> quiz (3 answers) -> re-entry.
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
await page.waitForTimeout(1000)

await page.mouse.click(195, 420) // begin
await page.waitForTimeout(3000)

// Walk near the waymark, then tap it.
await page.evaluate(() => window.__tkm.tapWorld(6.5, 0, -4))
await page.waitForTimeout(6000)
await page.evaluate(() => {
  const wm = window.__tkm.game.scene.waymark
  window.__tkm.tapWorld(wm.x, wm.y, wm.z)
})
console.log('tapped waymark')

let shots = 0
for (let q = 0; q < 3; q++) {
  // Poll until the quiz is actually accepting answers.
  let cards = []
  for (let i = 0; i < 80; i++) {
    await page.waitForTimeout(400)
    const ready = await page.evaluate(() => window.__tkm.quiz.currentPhase === 'cards')
    if (!ready) continue
    cards = await page.evaluate(() => window.__tkm.game.overlay.cardRects.map((c) => ({ ...c })))
    if (cards.length) break
  }
  if (!cards.length) {
    console.error('cards never appeared for question', q + 1)
    break
  }
  const st = await page.evaluate(() => window.__tkm.game.state)
  console.log(`question ${q + 1}: state=${st}, ${cards.length} cards`)
  if (shots === 0) {
    await page.screenshot({ path: 'shots/m3-quiz.png' })
    shots++
  }
  // Tap the middle of the second card (or first).
  const card = cards[Math.min(1, cards.length - 1)]
  const rt = await page.evaluate(() => ({
    w: window.__tkm.game.pipeline.rtWidth,
    h: window.__tkm.game.pipeline.rtHeight,
  }))
  const cx = ((card.x + card.w / 2) / rt.w) * 390
  const cy = ((card.y + card.h / 2) / rt.h) * 844
  await page.mouse.click(cx, cy)
  console.log(` answered: ${card.id}`)
  await page.waitForTimeout(1200)
}

// Wait for re-entry.
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(500)
  const st = await page.evaluate(() => window.__tkm.game.state)
  if (st === 'explore') break
}
await page.waitForTimeout(1500)
await page.screenshot({ path: 'shots/m3-reentry.png' })

const result = await page.evaluate(() => ({
  state: window.__tkm.game.state,
  trust: window.__tkm.trust?.value,
  quiz: window.__tkm.ledger.quiz.map((r) => ({
    detail: r.detailId,
    role: r.role,
    answer: r.playerAnswer,
    claim: r.machineClaim,
    agreed: r.agreedWithMachine,
  })),
}))
console.log(JSON.stringify(result, null, 1))

await browser.close()
if (errors.length) {
  console.error('PAGE ERRORS:')
  errors.forEach((e) => console.error(' - ' + e))
  process.exit(2)
}
console.log('M3 VERIFY DONE')
