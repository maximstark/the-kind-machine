// Headless screenshot of the dev server for self-verification.
// Usage: node tools/screenshot.mjs [outPath] [--wait ms] [--script "js"]
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'
import { dirname, resolve } from 'path'

const args = process.argv.slice(2)
const out = resolve(args.find((a) => !a.startsWith('--')) ?? 'shots/shot.png')
const waitIdx = args.indexOf('--wait')
const wait = waitIdx >= 0 ? parseInt(args[waitIdx + 1], 10) : 2500
const scriptIdx = args.indexOf('--script')
const script = scriptIdx >= 0 ? args[scriptIdx + 1] : null
const url = process.env.TKM_URL ?? 'http://localhost:5173/'

mkdirSync(dirname(out), { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text())
})

await page.goto(url, { waitUntil: 'networkidle' })
if (script) {
  await page.evaluate(script)
}
await page.waitForTimeout(wait)
await page.screenshot({ path: out })
await browser.close()

if (errors.length) {
  console.error('PAGE ERRORS:')
  for (const e of errors) console.error(' - ' + e)
  process.exit(2)
}
console.log('OK ' + out)
