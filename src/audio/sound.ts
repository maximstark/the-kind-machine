import { bus } from '../core/bus'
import { atmosphere } from '../core/atmosphere'

// All audio is synthesized: a two-oscillator drone with filtered noise and
// a slow LFO, a granular tick for the machine's voice, and small chimes.
// The context unlocks on the first tap (title screen = "begin").

// Machine voice treatments, A/B-selectable via ?voice= until one is chosen:
//   grain    — shipped default: randomized noise grain per character (typewriter)
//   reed     — the grain with all randomness removed; regularity reads mechanical
//   liturgy  — characters chant a fixed Am9 cycle, punctuation lands on the root
//   presence — reed tick + a breathing band-noise/beating-dyad bed while it speaks
//   choir    — liturgy tick + the presence bed
//   vox      — voice-like: wordless formant babble that follows the line's vowels,
//              monotone pitch, falling inflection at punctuation (no words, no VO)
//   hum      — voice-like: a sustained vowel hum that morphs while text reveals,
//              with the quiet reed tick typing over it
//   voice    — vox babble speaking over the hum bed (the combination)
export type VoiceMode = 'grain' | 'reed' | 'liturgy' | 'presence' | 'choir' | 'vox' | 'hum' | 'voice'
const VOICE_MODES: VoiceMode[] = ['grain', 'reed', 'liturgy', 'presence', 'choir', 'vox', 'hum', 'voice']

// Am9 chord tones (the drone sits at ~A1); the cycle resets each line so
// every sentence chants the same rising figure. Deliberately deterministic.
const LITURGY_FREQS = [220, 261.63, 329.63, 392, 493.88]
const LITURGY_ROOT = 110
const PUNCT = /[.,;:—?!…]/

// Rough F1/F2 formant pairs. The dark rounded vowels carry "calm";
// consonants collapse toward a closed 'u' so the babble never gets sharp.
const FORMANTS: Record<string, [number, number]> = {
  a: [780, 1150],
  e: [420, 1900],
  i: [360, 2100],
  o: [420, 820],
  u: [330, 640],
}
const VOWEL_WALK: [number, number][] = [FORMANTS.o, FORMANTS.a, FORMANTS.u, FORMANTS.e, FORMANTS.o]
const VOX_PITCH = 110 // monotone, the drone's root two octaves up — flat = machine

class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneFilter: BiquadFilterNode | null = null
  private tickBuf: AudioBuffer | null = null
  private started = false
  private voiceMode: VoiceMode = 'grain'
  private liturgyStep = 0
  private voxStep = 0
  private bedGain: GainNode | null = null
  private humGain: GainNode | null = null
  private humF1: BiquadFilterNode | null = null
  private humF2: BiquadFilterNode | null = null
  private humActive = false
  private humNextVowelAt = 0
  private humVowelStep = 0

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

    // --- hum voice: two barely-detuned saws through a slowly morphing
    // vowel (two formant bandpasses), silent until a line reveals ---
    const humGain = ctx.createGain()
    humGain.gain.value = 0
    humGain.connect(master)
    this.humGain = humGain
    const humF1 = ctx.createBiquadFilter()
    humF1.type = 'bandpass'
    humF1.frequency.value = FORMANTS.o[0]
    humF1.Q.value = 6
    const humF2 = ctx.createBiquadFilter()
    humF2.type = 'bandpass'
    humF2.frequency.value = FORMANTS.o[1]
    humF2.Q.value = 8
    this.humF1 = humF1
    this.humF2 = humF2
    const humF1Gain = ctx.createGain()
    humF1Gain.gain.value = 1.0
    const humF2Gain = ctx.createGain()
    humF2Gain.gain.value = 0.45
    humF1.connect(humF1Gain)
    humF2.connect(humF2Gain)
    humF1Gain.connect(humGain)
    humF2Gain.connect(humGain)
    for (const f of [VOX_PITCH, VOX_PITCH + 0.6]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.5
      o.connect(g)
      g.connect(humF1)
      g.connect(humF2)
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
    if (mode === 'vox' || mode === 'voice') {
      // Wordless formant babble. Vowels in the actual text pick the mouth
      // shape; consonants collapse to a closed dark blip; punctuation gets
      // a longer falling "mm". Monotone pitch — the flatness is the machine.
      const punct = !!ch && PUNCT.test(ch)
      if (!punct && this.voxStep++ % 2 !== 0) return // syllable rate, not char rate
      const vowel = ch && FORMANTS[ch.toLowerCase()]
      const [f1, f2] = punct ? FORMANTS.o : vowel || [340, 700]
      const dur = punct ? 0.26 : vowel ? 0.1 : 0.06
      const level = punct ? 0.8 : vowel ? 0.72 : 0.48
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(VOX_PITCH, ctx.currentTime)
      if (punct) o.frequency.exponentialRampToValueAtTime(94, ctx.currentTime + dur)
      const b1 = ctx.createBiquadFilter()
      b1.type = 'bandpass'
      b1.frequency.value = f1
      b1.Q.value = 7
      const b2 = ctx.createBiquadFilter()
      b2.type = 'bandpass'
      b2.frequency.value = f2
      b2.Q.value = 9
      const g1 = ctx.createGain()
      g1.gain.value = 1.0
      const g2 = ctx.createGain()
      g2.gain.value = 0.4
      const env = ctx.createGain()
      env.gain.setValueAtTime(0.0001, ctx.currentTime)
      env.gain.exponentialRampToValueAtTime(level, ctx.currentTime + 0.012)
      env.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur)
      o.connect(b1)
      o.connect(b2)
      b1.connect(g1)
      b2.connect(g2)
      g1.connect(env)
      g2.connect(env)
      env.connect(this.master)
      o.start()
      o.stop(ctx.currentTime + dur + 0.05)
      return
    }
    if (mode === 'liturgy' || mode === 'choir') {
      // Pitched chant blip: deterministic walk up the chord, punctuation
      // settles on the root an octave down.
      const punct = !!ch && PUNCT.test(ch)
      const freq = punct ? LITURGY_ROOT : LITURGY_FREQS[this.liturgyStep++ % LITURGY_FREQS.length]
      const dur = punct ? 0.4 : 0.12
      const level = punct ? 0.16 : 0.11
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
    // Grain family ('hum' keeps a quiet typing tick under its voice).
    // 'reed'/'presence'/'hum' strip every random parameter — the same
    // sound at the same interval is what reads as machine.
    const fixed = mode !== 'grain'
    const src = ctx.createBufferSource()
    src.buffer = this.tickBuf
    src.playbackRate.value = fixed ? 1.0 : 0.9 + Math.random() * 0.3
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = fixed ? 2150 : 1900 + Math.random() * 500
    bp.Q.value = fixed ? 9 : 7
    const g = ctx.createGain()
    g.gain.value = mode === 'presence' ? 0.34 : mode === 'hum' ? 0.22 : fixed ? 0.42 : 0.5
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start()
  }

  // Beds fade in while the machine is revealing text, out when it stops.
  voiceLineStart() {
    this.liturgyStep = 0
    this.voxStep = 0
    if (!this.ctx) return
    if (this.bedGain && (this.voiceMode === 'presence' || this.voiceMode === 'choir')) {
      this.bedGain.gain.setTargetAtTime(0.14, this.ctx.currentTime, 0.12)
    }
    if (this.humGain && (this.voiceMode === 'hum' || this.voiceMode === 'voice')) {
      this.humActive = true
      this.humNextVowelAt = this.ctx.currentTime + 0.55
      // Under the babble the hum sits lower so the "speech" stays on top.
      const level = this.voiceMode === 'voice' ? 0.22 : 0.3
      this.humGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.18)
    }
  }

  voiceLineEnd() {
    if (!this.ctx) return
    this.bedGain?.gain.setTargetAtTime(0, this.ctx.currentTime, 0.35)
    if (this.humGain) {
      this.humActive = false
      this.humGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4)
    }
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

  // The drone darkens with the weather; the hum walks its vowel while speaking.
  update() {
    if (!this.droneFilter || !this.ctx) return
    const target = 200 + atmosphere.amplitude * 420
    this.droneFilter.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.6)
    if (this.humActive && this.humF1 && this.humF2 && this.ctx.currentTime >= this.humNextVowelAt) {
      this.humNextVowelAt = this.ctx.currentTime + 0.55
      const [f1, f2] = VOWEL_WALK[++this.humVowelStep % VOWEL_WALK.length]
      this.humF1.frequency.setTargetAtTime(f1, this.ctx.currentTime, 0.22)
      this.humF2.frequency.setTargetAtTime(f2, this.ctx.currentTime, 0.22)
    }
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
