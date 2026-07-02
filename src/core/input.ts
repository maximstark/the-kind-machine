// Tap detection over pointer events. Mouse and touch both land here;
// drags and long-presses are not taps.

export class Input {
  onTap: ((clientX: number, clientY: number) => void) | null = null
  private downX = 0
  private downY = 0
  private downT = 0
  private active = false

  constructor(el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => {
      this.active = true
      this.downX = e.clientX
      this.downY = e.clientY
      this.downT = performance.now()
    })
    el.addEventListener('pointerup', (e) => {
      if (!this.active) return
      this.active = false
      const dx = e.clientX - this.downX
      const dy = e.clientY - this.downY
      const dt = performance.now() - this.downT
      if (dx * dx + dy * dy < 20 * 20 && dt < 500) {
        this.onTap?.(e.clientX, e.clientY)
      }
    })
    el.addEventListener('pointercancel', () => (this.active = false))
  }
}
