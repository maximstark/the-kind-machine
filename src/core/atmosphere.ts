// Visual weather for the render pipeline. It stirs on its own slow clock,
// and other systems may nudge it. It is not a mechanic.

class Atmosphere {
  private level = 0
  private target = 0
  private nextStir = 4

  // Scene-scaled floor; rises over the course of the game.
  baseline = 0

  // Nudge the weather. Strength 0..1.
  pulse(strength = 0.4) {
    this.target = Math.min(1, Math.max(this.target, strength))
  }

  update(dt: number, t: number) {
    if (t > this.nextStir) {
      this.target = Math.max(this.target, 0.04 + Math.random() * 0.1)
      this.nextStir = t + 5 + Math.random() * 16
    }
    this.target *= Math.exp(-dt / 1.4)
    const rate = this.target > this.level ? 0.08 : 0.9
    this.level += (this.target - this.level) * (1 - Math.exp(-dt / rate))
  }

  get amplitude() {
    return Math.min(1, this.baseline + this.level)
  }
}

export const atmosphere = new Atmosphere()
