import { bus } from '../core/bus'
import type { Overlay } from '../ui/overlay'

// The machine's voice: queued lines, per-character reveal, hold, then gone.
// Emits 'machine:tick' per revealed character (audio hooks onto this).

interface Line {
  text: string
  onDone?: () => void
  hold: number
  yFrac?: number
}

const CHARS_PER_SECOND = 30

export class MachineVoice {
  private queue: Line[] = []
  private current: Line | null = null
  private revealed = 0
  private holdLeft = 0
  private lastTickChar = 0

  say(text: string, opts: { onDone?: () => void; hold?: number; yFrac?: number } = {}) {
    this.queue.push({
      text,
      onDone: opts.onDone,
      hold: opts.hold ?? 1.6 + text.length * 0.028,
      yFrac: opts.yFrac,
    })
  }

  get busy() {
    return this.current !== null || this.queue.length > 0
  }

  clear() {
    this.queue = []
    this.current = null
    this.revealed = 0
  }

  update(dt: number) {
    if (!this.current) {
      const next = this.queue.shift()
      if (!next) return
      this.current = next
      this.revealed = 0
      this.holdLeft = next.hold
      this.lastTickChar = 0
      bus.emit('machine:line-start')
    }
    const line = this.current
    if (this.revealed < line.text.length) {
      this.revealed = Math.min(line.text.length, this.revealed + dt * CHARS_PER_SECOND)
      if (Math.floor(this.revealed) > this.lastTickChar) {
        this.lastTickChar = Math.floor(this.revealed)
        const ch = line.text[this.lastTickChar - 1]
        if (ch && ch !== ' ') bus.emit('machine:tick')
      }
    } else {
      this.holdLeft -= dt
      if (this.holdLeft <= 0) {
        this.current = null
        line.onDone?.()
      }
    }
  }

  draw(overlay: Overlay) {
    if (!this.current) return
    const line = this.current
    const shown = line.text.slice(0, Math.floor(this.revealed))
    if (!shown) return
    // Fade out over the last 0.6s of hold.
    const alpha =
      this.revealed >= line.text.length && this.holdLeft < 0.6 ? Math.max(0.15, this.holdLeft / 0.6) : 1
    overlay.machineText(shown, { alpha, yFrac: line.yFrac })
  }
}

export const voice = new MachineVoice()
