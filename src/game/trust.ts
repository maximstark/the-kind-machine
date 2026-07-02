import { bus } from '../core/bus'

// Hidden. Never rendered. The player should feel judged, not see a bar.
// Measures deference to the machine's account of events.

class Trust {
  private v = 0 // -1 defiant .. +1 deferent

  adjust(delta: number) {
    this.v = Math.max(-1, Math.min(1, this.v + delta))
    bus.emit('trust:changed', this.v)
  }

  get value() {
    return this.v
  }

  get band(): 'defiant' | 'wavering' | 'deferent' {
    if (this.v <= -0.25) return 'defiant'
    if (this.v >= 0.25) return 'deferent'
    return 'wavering'
  }
}

export const trust = new Trust()
