// Generates placeholder hero assets into src/assets/ — composed to the
// briefs in notes/asset-briefs.md (dark ground, poles, single subject) so
// the ingestion path runs end-to-end before Maxim's generations exist.
// His files replace these by overwriting the same names. Standalone
// (no dev server): node tools/make-placeholders.mjs
import { chromium } from 'playwright'
import { mkdirSync, writeFileSync } from 'fs'

mkdirSync('src/assets', { recursive: true })

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()

const results = await page.evaluate(() => {
  const INK = '#cfc9b8'
  const BG = '#0b0a0e'

  function makeCanvas(w, h) {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    g.fillStyle = BG
    g.fillRect(0, 0, w, h)
    return [c, g]
  }

  // --- title: tiny figure before an enormous threshold (brief #1) ---
  function title() {
    const [c, g] = makeCanvas(1024, 1280)
    g.strokeStyle = INK
    g.fillStyle = INK
    // The tear above.
    g.beginPath()
    g.moveTo(500, 40)
    g.lineTo(560, 28)
    g.lineTo(548, 64)
    g.closePath()
    g.fill()
    // Monumental door: arch outline, upper two-thirds.
    g.lineWidth = 14
    g.beginPath()
    g.moveTo(362, 900)
    g.lineTo(362, 420)
    g.arc(512, 420, 150, Math.PI, 0)
    g.lineTo(662, 900)
    g.stroke()
    // Ajar: a sliver of light within.
    g.fillRect(496, 470, 34, 430)
    // The pool the light makes on the floor.
    g.beginPath()
    g.ellipse(512, 1005, 210, 46, 0, 0, Math.PI * 2)
    g.fill()
    // The wanderer, lower third, dark against the pool.
    g.fillStyle = BG
    g.beginPath()
    g.moveTo(512, 905)
    g.lineTo(538, 1002)
    g.lineTo(486, 1002)
    g.closePath()
    g.fill()
    g.beginPath()
    g.arc(512, 898, 11, 0, Math.PI * 2)
    g.fill()
    // Margins dissolving into horizontal drag.
    g.fillStyle = INK
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647), (seed - 1) / 2147483646)
    for (let i = 0; i < 46; i++) {
      const y = 80 + rand() * 1120
      const len = 12 + rand() * 60
      if (rand() < 0.5) g.fillRect(rand() * 70, y, len, 3)
      else g.fillRect(1024 - rand() * 70 - len, y, len, 3)
    }
    return c.toDataURL('image/png')
  }

  // --- avatar: serene statue face, one wrongness (brief #2) ---
  function avatar() {
    const [c, g] = makeCanvas(1024, 1024)
    g.fillStyle = INK
    // Head and neck.
    g.beginPath()
    g.ellipse(512, 500, 248, 322, 0, 0, Math.PI * 2)
    g.fill()
    g.fillRect(432, 770, 160, 120)
    g.beginPath()
    g.moveTo(312, 1024)
    g.lineTo(422, 872)
    g.lineTo(602, 872)
    g.lineTo(712, 1024)
    g.closePath()
    g.fill()
    // Features carved in shadow.
    g.fillStyle = BG
    // Brow line + eye sockets, calm, closed-read.
    g.fillRect(392, 428, 110, 16)
    g.fillRect(524, 428, 110, 16)
    g.beginPath()
    g.ellipse(447, 490, 58, 26, 0, 0, Math.PI * 2)
    g.ellipse(579, 490, 58, 26, 0, 0, Math.PI * 2)
    g.fill()
    // Nose shadow, one side.
    g.beginPath()
    g.moveTo(512, 452)
    g.lineTo(512, 640)
    g.lineTo(466, 640)
    g.closePath()
    g.fill()
    // Lips.
    g.fillRect(448, 706, 128, 14)
    g.beginPath()
    g.ellipse(512, 742, 52, 10, 0, 0, Math.PI)
    g.fill()
    // The wrongness: a chip out of the left jaw, and a hairline seam.
    g.beginPath()
    g.moveTo(292, 596)
    g.lineTo(388, 630)
    g.lineTo(352, 706)
    g.lineTo(280, 668)
    g.closePath()
    g.fill()
    g.fillRect(596, 214, 5, 320)
    return c.toDataURL('image/png')
  }

  // --- ending: the door ajar, the beam through it, no figure (brief #3) ---
  function ending() {
    const [c, g] = makeCanvas(1024, 1280)
    g.fillStyle = INK
    g.strokeStyle = INK
    // Door frame edges.
    g.lineWidth = 18
    g.beginPath()
    g.moveTo(372, 980)
    g.lineTo(372, 330)
    g.arc(512, 330, 140, Math.PI, 0)
    g.lineTo(652, 980)
    g.stroke()
    // The gap, brighter than anything.
    g.beginPath()
    g.moveTo(478, 340)
    g.lineTo(552, 340)
    g.lineTo(576, 980)
    g.lineTo(462, 980)
    g.closePath()
    g.fill()
    // Light spilling through, widening toward the viewer.
    g.beginPath()
    g.moveTo(462, 980)
    g.lineTo(576, 980)
    g.lineTo(760, 1252)
    g.lineTo(286, 1252)
    g.closePath()
    g.fill()
    return c.toDataURL('image/png')
  }

  return { title: title(), avatar: avatar(), ending: ending() }
})

await browser.close()

for (const [name, dataUrl] of Object.entries(results)) {
  const out = `src/assets/${name}.png`
  writeFileSync(out, Buffer.from(dataUrl.split(',')[1], 'base64'))
  console.log('OK ' + out)
}
