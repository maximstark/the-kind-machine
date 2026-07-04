// Downsample any decodable audio to a lean 16-bit mono WAV (for shipping
// the spoken line: its content is lowpassed ~2.4-3.4kHz, so 16kHz is
// transparent at a third of the bytes).
// Usage: node tools/resample.mjs in.wav out.wav [rate=16000]
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const inPath = resolve(process.argv[2])
const outPath = resolve(process.argv[3])
const rate = parseInt(process.argv[4] ?? '16000', 10)

const b64 = readFileSync(inPath).toString('base64')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage()

const out = await page.evaluate(
  async ({ b64, rate }) => {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    // decodeAudioData resamples to the context rate; no render pass needed.
    const ctx = new OfflineAudioContext(1, 1, rate)
    const buf = await ctx.decodeAudioData(bytes.buffer.slice(0))
    const d = buf.getChannelData(0)
    const wav = new DataView(new ArrayBuffer(44 + d.length * 2))
    const wstr = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)) }
    wstr(0, 'RIFF')
    wav.setUint32(4, 36 + d.length * 2, true)
    wstr(8, 'WAVEfmt ')
    wav.setUint32(16, 16, true)
    wav.setUint16(20, 1, true)
    wav.setUint16(22, 1, true)
    wav.setUint32(24, rate, true)
    wav.setUint32(28, rate * 2, true)
    wav.setUint16(32, 2, true)
    wav.setUint16(34, 16, true)
    wstr(36, 'data')
    wav.setUint32(40, d.length * 2, true)
    for (let i = 0; i < d.length; i++) {
      wav.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(d[i] * 32767))), true)
    }
    let s = ''
    const wb = new Uint8Array(wav.buffer)
    for (let i = 0; i < wb.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, wb.subarray(i, i + 0x8000))
    }
    return { b64: btoa(s), duration: +buf.duration.toFixed(2) }
  },
  { b64, rate }
)

await browser.close()
writeFileSync(outPath, Buffer.from(out.b64, 'base64'))
console.log(`OK ${outPath} (${out.duration}s @ ${rate}Hz)`)
