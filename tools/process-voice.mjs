// ARCHIVIST voice processing chain — turns a raw spoken take into the
// machine's one spoken line (the scope-amended finale VO).
// Runs the whole chain in Web Audio inside headless Chrome so the processing
// vocabulary is identical to the game's live synthesis (same primitives,
// same root pitch, same dark-cathedral space).
//
// Usage: node tools/process-voice.mjs "notes/Final dialogue.m4a" [outBase] [--preset dark]
//   Writes <outBase>.wav (48k/16-bit mono) and <outBase>-verify.png.
//   Default outBase: notes/archivist-line-v1
//
// Presets:
//   default — the approved v1 chain: normalize/trim -> granular smear ->
//             subtle 110Hz ring-mod -> dark-vowel EQ -> 10-bit quantize mix
//             -> 3.5s cathedral convolver -> compressor. (Parameter-
//             deterministic: seeded jitter, same grain schedule every run.
//             Not bit-exact across runs — Chrome's convolver is threaded —
//             but renders are audibly identical.)
//   dark    — the accept-ending variant. The world on screen goes bright and
//             clean; this voice is what's underneath it: time-stretched 1.18x,
//             pitched ~3.5 semitones down with an octave-deep shadow layer,
//             55Hz carrier, heavier crush, 6s darker hall, and a reverse-reverb
//             pre-echo — the room answers each phrase before it is spoken,
//             because the archive already contains it. The line disintegrates
//             as it completes (grain jitter/detune widen with progress).
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

const args = process.argv.slice(2)
const presetIdx = args.indexOf('--preset')
const presetName = presetIdx >= 0 ? args[presetIdx + 1] : 'default'
const positional = args.filter((a, i) => !a.startsWith('--') && (presetIdx < 0 || i !== presetIdx + 1))
const inPath = resolve(positional[0] ?? 'notes/Final dialogue.m4a')
const outBase = resolve(positional[1] ?? 'notes/archivist-line-v1')

const PRESETS = {
  default: {
    stretch: 1.0,
    baseDetune: 0,
    progSpread: 0, // no disintegration
    jitterBase: 0.024,
    jitterEnd: 0.024,
    shadow: null,
    rmFreq: 110,
    rmMix: 0.32,
    dryMix: 0.68,
    eq: [
      ['highpass', 130, 0.7],
      ['peaking', 330, 1.2, 4],
      ['peaking', 820, 1.4, 3],
      ['peaking', 2200, 1.6, -5],
      ['lowpass', 3400, 0.7],
    ],
    crushSteps: 512,
    crushWet: 0.3,
    ir: { dur: 3.5, pow: 2.8, lp: 0.75 },
    revWet: 0.28,
    preDelay: 0.035,
    preEcho: null,
    tail: 4.0,
  },
  dark: {
    stretch: 1.18,
    baseDetune: -350,
    progSpread: 2.0,
    jitterBase: 0.024,
    jitterEnd: 0.07,
    shadow: { detune: -1550, gain: 0.35 },
    rmFreq: 55,
    rmMix: 0.42,
    dryMix: 0.58,
    eq: [
      ['highpass', 90, 0.7],
      ['peaking', 165, 1.1, 4],
      ['peaking', 820, 1.4, 2],
      ['peaking', 2200, 1.6, -6],
      ['lowpass', 2400, 0.7],
    ],
    crushSteps: 256,
    crushWet: 0.35,
    ir: { dur: 6.0, pow: 2.4, lp: 0.85 },
    revWet: 0.42,
    preDelay: 0.06,
    preEcho: { irDur: 2.2, pow: 2.2, lp: 0.8, wet: 0.16 },
    tail: 6.5,
  },
}
const preset = PRESETS[presetName]
if (!preset) {
  console.error('unknown preset: ' + presetName + ' (have: ' + Object.keys(PRESETS).join(', ') + ')')
  process.exit(1)
}

const b64 = readFileSync(inPath).toString('base64')

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const page = await browser.newPage({ viewport: { width: 1200, height: 640 } })
page.on('console', (m) => console.log('[page]', m.text()))

const result = await page.evaluate(async ({ b64, P }) => {
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
  const outDur = dur * P.stretch + P.tail

  const ctx = new OfflineAudioContext(1, Math.ceil(outDur * SR), SR)
  const buf = ctx.createBuffer(1, end - start, decoded.sampleRate)
  const bd = buf.getChannelData(0)
  for (let i = 0; i < bd.length; i++) bd[i] = src0[start + i] * norm

  // --- granular smear: two staggered layers of 90ms grains; jitter and
  // detune spread widen with progress under progSpread (disintegration) ---
  const grainBus = ctx.createGain()
  grainBus.gain.value = 1.0
  const GRAIN = 0.09
  const HOP = 0.045
  const DETUNES = [-12, 8, -5, 14]
  let gi = 0
  const spawnGrain = (t, layerOff, detuneBase, level) => {
    const prog = t / dur
    const jit = P.jitterBase + (P.jitterEnd - P.jitterBase) * prog
    const when = t * P.stretch + layerOff + (rand() - 0.5) * jit
    if (when < 0) return
    const g = ctx.createBufferSource()
    g.buffer = buf
    g.detune.value = detuneBase + DETUNES[gi++ % DETUNES.length] * (1 + P.progSpread * prog)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, when)
    env.gain.linearRampToValueAtTime(level, when + GRAIN * 0.3)
    env.gain.linearRampToValueAtTime(0.0001, when + GRAIN)
    g.connect(env)
    env.connect(grainBus)
    g.start(when, Math.min(t, dur - GRAIN), GRAIN)
  }
  for (const layerOff of [0, HOP / 2]) {
    for (let t = 0; t < dur - 0.01; t += HOP) spawnGrain(t, layerOff, P.baseDetune, 0.5)
  }
  if (P.shadow) {
    for (let t = 0; t < dur - 0.01; t += HOP) spawnGrain(t, HOP / 4, P.shadow.detune, 0.5 * P.shadow.gain)
  }

  // --- ring-mod at the root: the machine carrier under the words ---
  const eqIn = ctx.createGain()
  const dry = ctx.createGain()
  dry.gain.value = P.dryMix
  grainBus.connect(dry)
  dry.connect(eqIn)
  const rm = ctx.createGain()
  rm.gain.value = 0
  const carrier = ctx.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = P.rmFreq
  carrier.connect(rm.gain)
  carrier.start()
  const rmMix = ctx.createGain()
  rmMix.gain.value = P.rmMix
  grainBus.connect(rm)
  rm.connect(rmMix)
  rmMix.connect(eqIn)

  // --- EQ ---
  const eq = []
  for (const [type, freq, q, gain] of P.eq) {
    const f = ctx.createBiquadFilter()
    f.type = type
    f.frequency.value = freq
    f.Q.value = q
    if (gain !== undefined) f.gain.value = gain
    if (eq.length) eq[eq.length - 1].connect(f)
    eq.push(f)
  }
  eqIn.connect(eq[0])

  // --- bit quantize, mixed under the clean path ---
  const crushIn = eq[eq.length - 1]
  const shaper = ctx.createWaveShaper()
  const curve = new Float32Array(4096)
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1
    curve[i] = Math.round(x * P.crushSteps) / P.crushSteps
  }
  shaper.curve = curve
  const crushWet = ctx.createGain()
  crushWet.gain.value = P.crushWet
  const crushDry = ctx.createGain()
  crushDry.gain.value = 1 - P.crushWet
  const postCrush = ctx.createGain()
  crushIn.connect(shaper)
  shaper.connect(crushWet)
  crushWet.connect(postCrush)
  crushIn.connect(crushDry)
  crushDry.connect(postCrush)

  // --- cathedral: decaying-noise impulse, one-pole darkened ---
  const mkImpulse = (irDur, pow, lpA) => {
    const ir = ctx.createBuffer(1, Math.floor(SR * irDur), SR)
    const ird = ir.getChannelData(0)
    let lp = 0
    for (let i = 0; i < ird.length; i++) {
      const t = i / ird.length
      const s = (rand() * 2 - 1) * Math.pow(1 - t, pow)
      lp = lp * lpA + s * (1 - lpA)
      ird[i] = lp
    }
    return ir
  }
  const conv = ctx.createConvolver()
  conv.buffer = mkImpulse(P.ir.dur, P.ir.pow, P.ir.lp)
  const preDelay = ctx.createDelay(0.2)
  preDelay.delayTime.value = P.preDelay
  const wet = ctx.createGain()
  wet.gain.value = P.revWet
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

  // --- reverse-reverb pre-echo: the room answers before the words arrive ---
  if (P.preEcho) {
    const revBuf = new Float32Array(out.length)
    for (let i = 0; i < out.length; i++) revBuf[i] = out[out.length - 1 - i]
    const pctx = new OfflineAudioContext(1, out.length, SR)
    const pb = pctx.createBuffer(1, out.length, SR)
    pb.getChannelData(0).set(revBuf)
    const psrc = pctx.createBufferSource()
    psrc.buffer = pb
    const pconv = pctx.createConvolver()
    pconv.buffer = mkImpulse(P.preEcho.irDur, P.preEcho.pow, P.preEcho.lp)
    psrc.connect(pconv)
    pconv.connect(pctx.destination)
    psrc.start()
    const prendered = await pctx.startRendering()
    const pout = prendered.getChannelData(0)
    for (let i = 0; i < out.length; i++) out[i] += pout[out.length - 1 - i] * P.preEcho.wet
  }

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
}, { b64, P: preset })

await browser.close()
writeFileSync(outBase + '.wav', Buffer.from(result.wav, 'base64'))
writeFileSync(outBase + '-verify.png', Buffer.from(result.png, 'base64'))
console.log('preset', presetName, 'stats', JSON.stringify(result.stats))
console.log('OK ' + outBase + '.wav')
