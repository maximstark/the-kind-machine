import * as THREE from 'three'
import { Game } from './game/game'
import { ledger } from './game/ledger'
import { atmosphere } from './core/atmosphere'
import { buildField } from './game/scenes/field'
import { bus } from './core/bus'

const canvas = document.getElementById('game') as HTMLCanvasElement
const game = new Game(canvas)

game.loadScene(buildField())
game.onWaymark = () => {
  game.say('Soon. Look a little longer first.') // DRAFT — quiz wiring lands in M3
}

let last = performance.now()
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  const t = now / 1000
  game.update(dt, t)
  game.render(t)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) last = performance.now()
})

// Debug surface for automated verification (headless playthroughs).
;(window as any).__tkm = {
  game,
  ledger,
  atmosphere,
  bus,
  tapClient(x: number, y: number) {
    ;(game as any).handleTap(x, y)
  },
  // Tap a world position by projecting it to screen space first.
  tapWorld(x: number, y: number, z: number) {
    const p = game.worldToRt(new THREE.Vector3(x, y, z))
    ;(game as any).handleTap(
      (p.x / game.pipeline.rtWidth) * window.innerWidth,
      (p.y / game.pipeline.rtHeight) * window.innerHeight
    )
  },
}
