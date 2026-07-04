// Verifies the cross-run memory (archive) wiring, headless:
//  1. Fresh visit: archive.lastRun is null, cold open has no return line.
//  2. Seeded past run: cold open gains the return line, the field entry
//     gets the ending-specific beat, record() bumps visits.
// Usage: node tools/verify-return.mjs   (dev server must be running)
import { chromium } from 'playwright'

const RETURN_MARKER = 'Remembering is my part'
const KEEP_MARKER = 'kept your own account'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const fail = (msg) => {
  errors.push(msg)
  console.error('FAIL: ' + msg)
}

// Collect every line the voice speaks by polling currentText.
async function collectLines(untilState, timeoutMs = 120000) {
  return page.evaluate(
    ([target, timeout]) =>
      new Promise((resolveP) => {
        const seen = []
        const t0 = Date.now()
        const iv = setInterval(() => {
          const cur = window.__tkm.voice.currentText
          if (cur && seen[seen.length - 1] !== cur) seen.push(cur)
          if (window.__tkm.game.state === target || Date.now() - t0 > timeout) {
            clearInterval(iv)
            resolveP(seen)
          }
        }, 150)
      }),
    [untilState, timeoutMs]
  )
}

// --- 1. fresh visit ---
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const freshLast = await page.evaluate(() => window.__tkm.archive.lastRun)
if (freshLast !== null) fail('fresh visit: lastRun should be null, got ' + JSON.stringify(freshLast))

await page.mouse.click(195, 420) // begin
const freshLines = await collectLines('explore')
if (freshLines.some((l) => l.includes(RETURN_MARKER)))
  fail('fresh visit: return line appeared in cold open')
console.log('fresh visit: no return line, lastRun null — OK')

// --- 2. returning visit (seeded keep-run) ---
await page.evaluate(() =>
  localStorage.setItem(
    'tkm-archive-v1',
    JSON.stringify({
      ending: 'keep',
      band: 'defiant',
      resistedLie: true,
      agreedLie: false,
      followedFalseHint: false,
      visits: 1,
    })
  )
)
await page.reload({ waitUntil: 'networkidle' })
await page.waitForTimeout(800)

const seededLast = await page.evaluate(() => window.__tkm.archive.lastRun)
if (seededLast?.ending !== 'keep') fail('seeded visit: lastRun not loaded')

await page.mouse.click(195, 420)
const returnLines = await collectLines('explore')
// The field beat is queued behind the entry line. Keep collecting lines as
// they surface (a single timed sample races the line pacing) until the beat
// arrives or the window closes.
const lateLines = await page.evaluate(
  (marker) =>
    new Promise((resolveP) => {
      const seen = []
      const t0 = Date.now()
      const iv = setInterval(() => {
        const cur = window.__tkm.voice.currentText
        if (cur && seen[seen.length - 1] !== cur) seen.push(cur)
        if (seen.some((l) => l.includes(marker)) || Date.now() - t0 > 20000) {
          clearInterval(iv)
          resolveP(seen)
        }
      }, 150)
    }),
  KEEP_MARKER
)
const all = [...returnLines, ...lateLines].filter(Boolean)
if (!all.some((l) => l.includes(RETURN_MARKER))) fail('returning: cold open return line missing')
if (!all.some((l) => l.includes(KEEP_MARKER))) fail('returning: field keep-beat missing')
console.log('returning visit: cold open + field beat present — OK')

// --- 3. record() bumps visits ---
const rec = await page.evaluate(() => {
  window.__tkm.archive.record('accept')
  return JSON.parse(localStorage.getItem('tkm-archive-v1'))
})
if (rec.ending !== 'accept' || rec.visits !== 2)
  fail('record(): expected accept/visits=2, got ' + JSON.stringify(rec))
console.log('record(): visits bumped, ending overwritten — OK')

await page.evaluate(() => localStorage.clear())
await browser.close()
if (errors.length) {
  console.error('VERIFY-RETURN FAILED')
  errors.forEach((e) => console.error(' - ' + e))
  process.exit(2)
}
console.log('VERIFY-RETURN PASSED')
