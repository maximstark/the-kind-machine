import { chromium } from 'playwright'
import { pathToFileURL } from 'url'
import { resolve } from 'path'

const html = resolve(process.argv[2])
const out = resolve(process.argv[3])

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' })
await page.waitForTimeout(400)
await page.screenshot({ path: out })
await browser.close()
console.log('OK ' + out)
