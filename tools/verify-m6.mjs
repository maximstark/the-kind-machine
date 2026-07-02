// M6 verification: flourish prefetch fires, stub responds, line is spoken
// at the slot; audio unlock produces no errors headlessly.
import { chromium } from 'playwright'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  hasTouch: true,
  isMobile: true,
})
const errors = []
const flourishCalls = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('request', (r) => {
  if (r.url().includes('/api/flourish')) flourishCalls.push(r.postData())
})
page.on('response', async (r) => {
  if (r.url().includes('/api/flourish')) {
    console.log('flourish response:', await r.text())
  }
})
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1000)
await page.mouse.click(195, 420)
await page.waitForTimeout(2000)

// Watch what the voice says for ~25s.
const said = new Set()
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(500)
  const cur = await page.evaluate(() => {
    const v = window.__tkm.voice
    return v.currentText ?? null
  })
  if (cur) said.add(cur)
}
console.log('flourish requests:', flourishCalls.length)
console.log('lines spoken:')
for (const s of said) console.log(' -', s)

await browser.close()
if (errors.length) {
  console.error('PAGE ERRORS:')
  errors.forEach((e) => console.error(' - ' + e))
  process.exit(2)
}
console.log('M6 VERIFY DONE')
