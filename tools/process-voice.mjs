// ARCHIVIST voice processing chain — turns a raw spoken take into the
// machine's one spoken line (the scope-amended finale VO).
// Runs the whole chain in Web Audio inside headless Chrome so the processing
// vocabulary is identical to the game's live synthesis (same primitives,
// same 110Hz root, same dark-cathedral space).
//
// Usage: node tools/process-voice.mjs "notes/Final dialogue.m4a" [outBase]
//   Writes <outBase>.wav (processed, 48k/16-bit mono) and <outBase>-verify.png
//   (waveform before/after). Default outBase: notes/archivist-line-v1
//
// Chain: normalize + silence-trim -> granular smear (the corruption idiom)
//   -> subtle 110Hz ring-mod (machine carrier) -> EQ toward the babble's
//   formant palette -> gentle bit-quantize -> dark 3.5s cathedral convolver
//   -> compressor -> normalize to -1.5dBFS.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const inPath = resolve(process.argv[2] ?? 'notes/Final dialogue.m4a')
const outBase = resolve(process.argv[3] ?? 'notes/archivist-line-v1')

const b64 = readFileSync(inPath).toString('base64')

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 640 } })
page.on('console', (m) => console.log('[page]', m.text()))

const result = await page.evaluate(async (b64) => {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
  const SR = 48000

  // Deterministic jitter so reprocessing the same take is reproducible.
  let seed = 0x9e3779b9
  const rand = () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const decodeCtx = new OfflineAudioContext(1, 1, SR)
  const decoded = await decodeCtx.decodeAudioData(bytes.buffer.slice(0))
  const src0 = decoded.getChannelData(0)

  // --- normalize source, trim silence (keep 0.25s pads) ---
  let peak = 0
  for (let i = 0; i < src0.length; i++) peak = Math.max(peak, Math.abs(src0[i]))
  const norm = peak > 0 ? 0.9 / peak : 1
  const thresh = 0.9 * 0.005 // ~-45dB rel normalized peak
  const win = Math.floor(decoded.sampleRate * 0.02)
  let start = 0
  let end = src0.length
  for (let i = 0; i < src0.length; i += win) {
    let m = 0
    for (let j = i; j < Math.min(i + win, src0.length); j++) m = Math.max(m, Math.abs(src0[j] * norm))
    if (m > thresh) { start = Math.max(0, i - decoded.sampleRate * 0.25); break }
  }
  for (let i = src0.length - win; i >= 0; i -= win) {
    let m = 0
    for (let j = i; j < Math.min(i + win, src0.length); j++) m = Math.max(m, Math.abs(src0[j] * norm))
    if (m > thresh) { end = Math.min(src0.length, i + win + decoded.sampleRate * 0.25); break }
  }
  const dur = (end - start) / decoded.sampleRate
  const TAIL = 4.0
  const ctx = new OfflineAudioContext(1, Math.ceil((dur + TAIL) * SR), SR)
  const buf = ctx.createBuffer(1, end - start, decoded.sampleRate)
  const bd = buf.getChannelData(0)
  for (let i = 0; i < bd.length; i++) bd[i] = src0[start + i] * norm

  // --- granular smear: two staggered layers of 90ms grains, ±12ms jitter,
  // deterministic detune walk (the corruption layer's idiom, in time) ---
  const grainBus = ctx.createGain()
  grainBus.gain.value = 1.0
  const GRAIN = 0.09
  const HOP = 0.045
  const DETUNES = [-12, 8, -5, 14]
  let gi = 0
  for (const layerOff of [0, HOP / 2]) {
    for (let t = 0; t < dur - 0.01; t += HOP) {
      const when = t + layerOff + (rand() - 0.5) * 0.024
      if (when < 0) continue
      const g = ctx.createBufferSource()
      g.buffer = buf
      g.detune.value = DETUNES[gi++ % DETUNES.length]
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, when)
      env.gain.linearRampToValueAtTime(0.5, when + GRAIN * 0.3)
      env.gain.linearRampToValueAtTime(0.0001, when + GRAIN)
      g.connect(env)
      env.connect(grainBus)
      g.start(when, Math.min(t, dur - GRAIN), GRAIN)
    }
  }

  // --- subtle ring-mod at the root: the machine carrier under the words ---
  const eqIn = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = 0.68
  grainBus.connect(dry)
  dry.connect(eqIn)
  const rm = ctx.createGain()
  rm.gain.value = 0
  const carrier = ctx.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = 110
  carrier.connect(rm.gain)
  carrier.start()
  const rmMix = ctx.createGain()
  rmMix.gain.value = 0.32
  grainBus.connect(rm)
  rm.connect(rmMix)
  rmMix.connect(eqIn)

  // --- EQ toward the babble's dark vowels, tame modern-mic sheen ---
  const eq = []
  const mk = (type, freq, q, gain) => {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    if (gain !== undefined) f.gain.value = gain
    eq.push(f)
    return f
  }
  mk('highpass', 130, 0.7)
  mk('peaking', 330, 1.2, 4)   // u
  mk('peaking', 820, 1.4, 3)   // o
  mk('peaking', 2200, 1.6, -5) // sibilance shelf-down
  mk('lowpass', 3400, 0.7)
  for (let i = 1; i < eq.length; i++) eq[i - 1].connect(eq[i])
  eqIn.connect(eq[0])

  // --- gentle bit quantize (10-bit), mixed under the clean path ---
  const crushIn = eq[eq.length - 1]
  const shaper = ctx.createWaveShaper()
  const curve = new Float32Array(4096)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.round(x * 512) / 512
  }
  shaper.curve = curve
  const crushWet = ctx.createGain()
  crushWet.gain.value = 0.3
  const crushDry = ctx.createGain()
  crushDry.gain.value = 0.7
  const postCrush = ctx.createGain()
  crushIn.connect(shaper)
  shaper.connect(crushWet)
  crushWet.connect(postCrush)
  crushIn.connect(crushDry)
  crushDry.connect(postCrush)

  // --- dark cathedral: 3.5s decaying-noise impulse, one-pole darkened ---
  const IR_DUR = 3.5
  const ir = ctx.createBuffer(1, Math.floor(SR * IR_DUR), SR)
  const ird = ir.getChannelData(0)
  let lp = 0
  for (let i = 0; i < ird.length; i++) {
    const t = i / ird.length
    const s = (rand() * 2 - 1) * Math.pow(1 - t, 2.8)
    lp = lp * 0.75 + s * 0.25
    ird[i] = lp
  }
  const conv = ctx.createConvolver()
  conv.buffer = ir
  const preDelay = ctx.createDelay(0.1)
  preDelay.delayTime.value = 0.035
  const wet = ctx.createGain()
  wet.gain.value = 0.28
  const dryOut = ctx.createGain()
  dryOut.gain.value = 1.0
  postCrush.connect(dryOut)
  postCrush.connect(preDelay)
  preDelay.connect(conv)
  conv.connect(wet)

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -18
  comp.knee.value = 12
  comp.ratio.value = 3
  comp.attack.value = 0.01
  comp.release.value = 0.25
  dryOut.connect(comp)
  wet.connect(comp)
  comp.connect(ctx.destination)

  const rendered = await ctx.startRendering()
  const out = rendered.getChannelData(0)

  // --- normalize to -1.5dBFS, stats ---
  let opeak = 0
  let rms = 0
  for (let i = 0; i < out.length; i++) {
    opeak = Math.max(opeak, Math.abs(out[i]))
    rms += out[i] * out[i]
  }
  rms = Math.sqrt(rms / out.length)
  const target = Math.pow(10, -1.5 / 20)
  const onorm = opeak > 0 ? target / opeak : 1
  for (let i = 0; i < out.length; i++) out[i] *= onorm

  // --- 16-bit WAV encode ---
  const wav = new DataView(new ArrayBuffer(44 + out.length * 2))
  const wstr = (o, s) => { for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i)) }
  wstr(0, 'RIFF')
  wav.setUint32(4, 36 + out.length * 2, true)
  wstr(8, 'WAVEfmt ')
  wav.setUint32(16, 16, true)
  wav.setUint16(20, 1, true)
  wav.setUint16(22, 1, true)
  wav.setUint32(24, SR, true)
  wav.setUint32(28, SR * 2, true)
  wav.setUint16(32, 2, true)
  wav.setUint16(34, 16, true)
  wstr(36, 'data')
  wav.setUint32(40, out.length * 2, true)
  for (let i = 0; i < out.length; i++) {
    wav.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(out[i] * 32767))), true)
  }
  let wb64 = ''
  const wbytes = new Uint8Array(wav.buffer)
  for (let i = 0; i < wbytes.length; i += 0x8000) {
    wb64 += String.fromCharCode.apply(null, wbytes.subarray(i, i + 0x8000))
  }

  // --- verification waveforms: source (trimmed) over processed ---
  const cv = document.createElement('canvas')
  cv.width = 1200
  cv.height = 640
  document.body.style.margin = '0'
  document.body.appendChild(cv)
  const g2d = cv.getContext('2d')
  g2d.fillStyle = '#131118'
  g2d.fillRect(0, 0, 1200, 640)
  const draw = (data, y0, h, color, label) => {
    g2d.strokeStyle = color
    g2d.beginPath()
    const step = Math.ceil(data.length / 1200)
    for (let x = 0; x < 1200; x++) {
      let mn = 1
      let mx = -1
      for (let j = x * step; j < Math.min((x + 1) * step, data.length); j++) {
        mn = Math.min(mn, data[j])
        mx = Math.max(mx, data[j])
      }
      g2d.moveTo(x, y0 + h / 2 + mn * (h / 2) * 0.92)
      g2d.lineTo(x, y0 + h / 2 + mx * (h / 2) * 0.92)
    }
    g2d.stroke()
    g2d.fillStyle = '#8f8b81'
    g2d.font = 'bold 16px Consolas, monospace'
    g2d.fillText(label, 12, y0 + 22)
  }
  draw(bd, 0, 320, '#7e7b72', 'source (normalized, trimmed)')
  draw(out, 320, 320, '#79c489', 'processed')
  return {
    wav: btoa(wb64),
    png: cv.toDataURL('image/png').split(',')[1],
    stats: {
      srcDuration: +(decoded.duration.toFixed(2)),
      trimmedDuration: +dur.toFixed(2),
      outDuration: +(out.length / SR).toFixed(2),
      peakBeforeNorm: +opeak.toFixed(3),
      rms: +rms.toFixed(4),
    },
  }
}, b64)

await browser.close()
writeFileSync(outBase + '.wav', Buffer.from(result.wav, 'base64'))
writeFileSync(outBase + '-verify.png', Buffer.from(result.png, 'base64'))
console.log('stats', JSON.stringify(result.stats))
console.log('OK ' + outBase + '.wav')
