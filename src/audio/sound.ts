import { bus } from '../core/bus'
import { atmosphere } from '../core/atmosphere'

// All audio is synthesized: a two-oscillator drone with filtered noise and
// a slow LFO, a granular tick for the machine's voice, and small chimes.
// The context unlocks on the first tap (title screen = "begin").

// Machine voice treatments, A/B-selectable via ?voice= until one is chosen:
//   grain    — shipped default: randomized noise grain per character
//   reed     — the grain with all randomness removed; regularity reads mechanical
//   liturgy  — characters chant a fixed Am9 cycle, punctuation lands on the root
//   presence — reed tick + a breathing band-noise/beating-dyad bed while it speaks
//   choir    — liturgy tick + the presence bed
export type VoiceMode = 'grain' | 'reed' | 'liturgy' | 'presence' | 'choir'
const VOICE_MODES: VoiceMode[] = ['grain', 'reed', 'liturgy', 'presence', 'choir']

// Am9 chord tones (the drone sits at ~A1); the cycle resets each line so
// every sentence chants the same rising figure. Deliberately deterministic.
const LITURGY_FREQS = [220, 261.63, 329.63, 392, 493.88]
const LITURGY_ROOT = 110
const PUNCT = /[.,;:—?!…]/

class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneFilter: BiquadFilterNode | null = null
  private tickBuf: AudioBuffer | null = null
  private started = false
  private voiceMode: VoiceMode = 'grain'
  private liturgyStep = 0
  private bedGain: GainNode | null = null

  unlock() {
    if (this.started) return
    this.started = true
    const AC = window.AudioContext ?? (window as any).webkitAudioContext
    if (!AC) return
    const ctx = new AC()
    this.ctx = ctx
    ctx.resume()

    const master = ctx.createGain()
    master.gain.value = 0.16
    master.connect(ctx.destination)
    this.master = master

    // --- drone: two detuned oscillators through a wandering lowpass ---
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 220
    filter.Q.value = 1.4
    this.droneFilter = filter

    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.55
    filter.connect(droneGain)
    droneGain.connect(master)

    const o1 = ctx.createOscillator()
    o1.type = 'sawtooth'
    o1.frequency.value = 54
    const g1 = ctx.createGain()
    g1.gain.value = 0.5
    o1.connect(g1)
    g1.connect(filter)
    o1.start()

    const o2 = ctx.createOscillator()
    o2.type = 'sawtooth'
    o2.frequency.value = 54.4
    const g2 = ctx.createGain()
    g2.gain.value = 0.5
    o2.connect(g2)
    g2.connect(filter)
    o2.start()

    // filtered noise bed
    const noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const nd = noiseBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.35
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true
    const noiseFilter = ctx.createBiquadFilter()
    noiseFilter.type = 'bandpass'
    noiseFilter.frequency.value = 160
    noiseFilter.Q.value = 0.8
    const noiseGain = ctx.createGain()
    noiseGain.gain.value = 0.16
    noise.connect(noiseFilter)
    noiseFilter.connect(noiseGain)
    noiseGain.connect(master)
    noise.start()

    // slow LFO on the drone filter
    const lfo = ctx.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 0.05
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 60
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    // tick sample: a 20ms grain
    const tickBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.02), ctx.sampleRate)
    const td = tickBuf.getChannelData(0)
    for (let i = 0; i < td.length; i++) {
      const env = 1 - i / td.length
      td[i] = (Math.random() * 2 - 1) * env * env
    }
    this.tickBuf = tickBuf

    // --- speech bed (presence/choir): breathing band-noise + beating dyad,
    // silent until a line is being revealed ---
    const bedGain = ctx.createGain()
    bedGain.gain.value = 0
    bedGain.connect(master)
    this.bedGain = bedGain

    const bedNoise = ctx.createBufferSource()
    bedNoise.buffer = noiseBuf
    bedNoise.loop = true
    const bedFilter = ctx.createBiquadFilter()
    bedFilter.type = 'bandpass'
    bedFilter.frequency.value = 880
    bedFilter.Q.value = 5
    const bedLfo = ctx.createOscillator()
    bedLfo.type = 'sine'
    bedLfo.frequency.value = 0.13
    const bedLfoGain = ctx.createGain()
    bedLfoGain.gain.value = 130
    bedLfo.connect(bedLfoGain)
    bedLfoGain.connect(bedFilter.frequency)
    bedLfo.start()
    const bedNoiseGain = ctx.createGain()
    bedNoiseGain.gain.value = 0.5
    bedNoise.connect(bedFilter)
    bedFilter.connect(bedNoiseGain)
    bedNoiseGain.connect(bedGain)
    bedNoise.start()

    for (const f of [LITURGY_ROOT, LITURGY_ROOT + 0.7]) {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.28
      o.connect(g)
      g.connect(bedGain)
      o.start()
    }

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) this.ctx.suspend()
      else this.ctx.resume()
    })
  }

  setVoiceMode(mode: VoiceMode) {
    if (VOICE_MODES.includes(mode)) this.voiceMode = mode
  }

  // The machine's voice, per revealed character.
  tick(ch?: string) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.tickBuf) return
    const mode = this.voiceMode
    if (mode === 'liturgy' || mode === 'choir') {
      // Pitched chant blip: deterministic walk up the chord, punctuation
      // settles on the root an octave down.
      const punct = !!ch && PUNCT.test(ch)
      const freq = punct ? LITURGY_ROOT : LITURGY_FREQS[this.liturgyStep++ % LITURGY_FREQS.length]
      const dur = punct ? 0.4 : 0.12
      const level = punct ? 0.1 : 0.07
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = freq
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 0.005)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
      o.connect(g)
      g.connect(this.master)
      o.start()
      o.stop(ctx.currentTime + dur + 0.05)
      return
    }
    // Grain family. 'reed'/'presence' strip every random parameter — the
    // same sound at the same interval is what reads as machine.
    const fixed = mode !== 'grain'
    const src = ctx.createBufferSource()
    src.buffer = this.tickBuf
    src.playbackRate.value = fixed ? 1.0 : 0.9 + Math.random() * 0.3
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = fixed ? 2150 : 1900 + Math.random() * 500
    bp.Q.value = fixed ? 9 : 7
    const g = ctx.createGain()
    g.gain.value = mode === 'presence' ? 0.34 : fixed ? 0.42 : 0.5
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start()
  }

  // The bed fades in while the machine is revealing text, out when it stops.
  voiceLineStart() {
    this.liturgyStep = 0
    if (!this.ctx || !this.bedGain) return
    if (this.voiceMode === 'presence' || this.voiceMode === 'choir') {
      this.bedGain.gain.setTargetAtTime(0.09, this.ctx.currentTime, 0.12)
    }
  }

  voiceLineEnd() {
    if (!this.ctx || !this.bedGain) return
    this.bedGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35)
  }

  // Footfall on ash: a soft, low, brief thud.
  thud() {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(95 + Math.random() * 15, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.09)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.05, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1)
    o.connect(g)
    g.connect(this.master)
    o.start()
    o.stop(ctx.currentTime + 0.12)
  }

  chime(freq = 660, dur = 0.5, level = 0.12) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = freq
    const g = ctx.createGain()
    g.gain.setValueAtTime(level, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
    o.connect(g)
    g.connect(this.master)
    o.start()
    o.stop(ctx.currentTime + dur + 0.05)
  }

  // Ink-scratch: noise sweep for the dissolve.
  scratch(dur = 1.4) {
    const ctx = this.ctx
    if (!ctx || !this.master) return
    const len = Math.floor(ctx.sampleRate * dur)
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) {
      const p = i / len
      d[i] = (Math.random() * 2 - 1) * (1 - p) * 0.5
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 2.5
    bp.frequency.setValueAtTime(600, ctx.currentTime)
    bp.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + dur)
    const g = ctx.createGain()
    g.gain.value = 0.4
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start()
  }

  // The drone darkens with the weather.
  update() {
    if (!this.droneFilter || !this.ctx) return
    const target = 200 + atmosphere.amplitude * 420
    this.droneFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.6)
  }
}

export const sound = new Sound()

// ?voice=reed|liturgy|presence|choir for A/B on a phone; default is the
// shipped grain. Also settable live from devtools: __voice('choir').
const voiceParam = new URLSearchParams(location.search).get('voice')
if (voiceParam) sound.setVoiceMode(voiceParam as VoiceMode)
;(window as any).__voice = (m: VoiceMode) => sound.setVoiceMode(m)

bus.on('game:begin', () => sound.unlock())
bus.on('machine:tick', (ch) => sound.tick(ch as string | undefined))
bus.on('machine:line-start', () => sound.voiceLineStart())
bus.on('machine:reveal-done', () => sound.voiceLineEnd())
bus.on('char:step', () => sound.thud())
bus.on('quiz:card-picked', () => sound.chime(720, 0.35, 0.08))
bus.on('dissolve:out', () => sound.scratch(1.5))
bus.on('dissolve:in', () => sound.scratch(1.8))
