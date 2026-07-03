// Tap detection over pointer events; mouse and touch both land here and
// drags and long-presses are not taps. Keyboard state rides along for
// desktop: WASD/arrows to walk, Space/Enter/E to act.

const KEY_DIRS: Record<string, [number, number]> = {
  // Screen-relative: up the screen is the world (-x,-z) diagonal.
  KeyW: [-0.707, -0.707],
  ArrowUp: [-0.707, -0.707],
  KeyS: [0.707, 0.707],
  ArrowDown: [0.707, 0.707],
  KeyA: [-0.707, 0.707],
  ArrowLeft: [-0.707, 0.707],
  KeyD: [0.707, -0.707],
  ArrowRight: [0.707, -0.707],
}

export class Input {
  onTap: ((clientX: number, clientY: number) => void) | null = null
  onAction: (() => void) | null = null // Space / Enter / E
  private downX = 0
  private downY = 0
  private downT = 0
  private active = false
  private held = new Set<string>()
  keyboardSeen = false

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

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return
      this.keyboardSeen = true
      if (KEY_DIRS[e.code]) {
        this.held.add(e.code)
        e.preventDefault()
      } else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') {
        this.onAction?.()
        e.preventDefault()
      }
    })
    window.addEventListener('keyup', (e) => this.held.delete(e.code))
    window.addEventListener('blur', () => this.held.clear())
  }

  // Combined desired walking direction in world xz, or null.
  heldDirection(): { x: number; z: number } | null {
    if (!this.held.size) return null
    let x = 0
    let z = 0
    for (const code of this.held) {
      const d = KEY_DIRS[code]
      if (d) {
        x += d[0]
        z += d[1]
      }
    }
    const len = Math.hypot(x, z)
    if (len < 0.01) return null
    return { x: x / len, z: z / len }
  }
}
