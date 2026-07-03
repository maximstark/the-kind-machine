// Desktop verification: wide viewport letterbox, keyboard begin/skip/walk.
import { chromium } from 'playwright'
import { mkdirSync } from 'fs'

mkdirSync('shots', { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto(process.env.TKM_URL ?? 'http://localhost:5173/', { waitUntil: 'networkidle' })
await page.waitForTimeout(1200)
await page.screenshot({ path: 'shots/desktop-title.png' })

// Begin with Enter, skip the cold open with Space.
await page.keyboard.press('Enter')
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(350)
  const st = await page.evaluate(() => window.__tkm.game.state)
  if (st === 'cold-open') await page.keyboard.press('Space')
  if (st === 'explore') break
}
console.log('state:', await page.evaluate(() => window.__tkm.game.state))

// Walk with W for a bit, then D.
const before = await page.evaluate(() => ({ ...window.__tkm.game.player.cell }))
await page.keyboard.down('KeyW')
await page.waitForTimeout(2500)
await page.keyboard.up('KeyW')
await page.keyboard.down('KeyD')
await page.waitForTimeout(1500)
await page.keyboard.up('KeyD')
await page.waitForTimeout(800)
const after = await page.evaluate(() => ({ ...window.__tkm.game.player.cell }))
console.log('cell before:', JSON.stringify(before), 'after:', JSON.stringify(after))
await page.screenshot({ path: 'shots/desktop-explore.png' })

// Mouse click-to-walk still works through the letterbox mapping.
await page.mouse.click(720, 380)
await page.waitForTimeout(2500)
const after2 = await page.evaluate(() => ({ ...window.__tkm.game.player.cell }))
console.log('after click-walk:', JSON.stringify(after2))

await browser.close()
if (errors.length) {
  console.error('PAGE ERRORS:')
  errors.forEach((e) => console.error(' - ' + e))
  process.exit(2)
}
console.log('DESKTOP VERIFY DONE')
