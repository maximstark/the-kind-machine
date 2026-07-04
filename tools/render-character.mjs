// Renders the wanderer sprite sheet via /sheet.html (headless).
// Usage: node tools/render-character.mjs [out.png]
// Needs the dev server running (npm run dev); TKM_URL overrides the base URL.
// Default output lands in notes/ — OneDrive-synced for Maxim, never shipped.
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'
import { dirname, resolve } from 'path'

const out = resolve(process.argv[2] ?? 'notes/character-sheet.png')
const base = process.env.TKM_URL ?? 'http://localhost:5173/'
mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  // The dev server has no favicon; that 404 is noise, not a failure.
  if (m.type() === 'error' && !m.text().includes('404')) errors.push(m.text())
})

await page.goto(new URL('sheet.html', base).href, { waitUntil: 'networkidle' })
await page.waitForFunction(() => window.__sheetStatus === 'done', null, { timeout: 90_000 })
const dataUrl = await page.evaluate(() => window.__sheetPng)
writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'))
await browser.close()

if (errors.length) {
  console.error('PAGE ERRORS:')
  for (const e of errors) console.error(' - ' + e)
  process.exit(2)
}
console.log('OK ' + out)
