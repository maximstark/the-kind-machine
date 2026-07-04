// Saves the card isolation renders via /cards.html (headless): the title
// art and both ending-illustration treatments, pipeline-faithful, no type.
// Usage: node tools/render-cards.mjs [outDir]
// Needs the dev server running (npm run dev); TKM_URL overrides the base URL.
// Default output lands in notes/ — OneDrive-synced for Maxim, never shipped.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

const outDir = resolve(process.argv[2] ?? 'notes')
const base = process.env.TKM_URL ?? 'http://localhost:5173/'
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text())
})

await page.goto(new URL('cards.html', base).href, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__cardsStatus === 'done', null, { timeout: 60_000 })
const cards = await page.evaluate(() => window.__cards)
await browser.close()

const names = Object.keys(cards)
if (!names.length) {
  console.error('no cards rendered — are the src/assets/ slots populated?')
  process.exit(2)
}
for (const name of names) {
  const out = join(outDir, `card-${name}.png`)
  writeFileSync(out, Buffer.from(cards[name].split(',')[1], 'base64'))
  console.log('OK ' + out)
}

if (errors.length) {
  console.error('PAGE ERRORS:')
  for (const e of errors) console.error(' - ' + e)
  process.exit(2)
}
