import { bus } from '../core/bus'
import { atmosphere } from '../core/atmosphere'

// All audio is synthesized: a two-oscillator drone with filtered noise and
// a slow LFO, a granular tick for the machine's voice, and small chimes.
// The context unlocks on the first tap (title screen = "begin").

class Sound {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private droneFilter: BiquadFilterNode | null = null
  private tickBuf: AudioBuffer | null = null
  private started = false

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

    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return
      if (document.hidden) this.ctx.suspend()
      else this.ctx.resume()
    })
  }

  // The machine's voice grain, per character.
  tick() {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.tickBuf) return
    const src = ctx.createBufferSource()
    src.buffer = this.tickBuf
    src.playbackRate.value = 0.9 + Math.random() * 0.3
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 1900 + Math.random() * 500
    bp.Q.value = 7
    const g = ctx.createGain()
    g.gain.value = 0.5
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start()
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

bus.on('game:begin', () => sound.unlock())
bus.on('machine:tick', () => sound.tick())
bus.on('quiz:card-picked', () => sound.chime(720, 0.35, 0.08))
bus.on('dissolve:out', () => sound.scratch(1.5))
bus.on('dissolve:in', () => sound.scratch(1.8))
