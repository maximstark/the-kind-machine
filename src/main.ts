import * as THREE from 'three'
import { Game } from './game/game'
import { ledger } from './game/ledger'
import { trust } from './game/trust'
import { archive } from './game/archive'
import { quizController } from './game/quiz'
import { voice } from './game/machine'
import { sound } from './audio/sound'
import { atmosphere } from './core/atmosphere'
import { buildField } from './game/scenes/field'
import { buildChapel } from './game/scenes/chapel'
import { buildTower } from './game/scenes/tower'
import { buildDoor } from './game/scenes/door'
import { bus } from './core/bus'
import type { GameScene } from './game/scenes/types'

const canvas = document.getElementById('game') as HTMLCanvasElement
const game = new Game(canvas)

const CHAIN: Array<() => GameScene> = [buildField, buildChapel, buildTower, buildDoor]
let sceneIndex = 0

game.loadScene(CHAIN[0]())
game.onAdvance = () => {
  sceneIndex++
  if (sceneIndex < CHAIN.length) {
    game.travelTo(CHAIN[sceneIndex])
  }
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
  trust,
  archive,
  sound,
  quiz: quizController,
  voice,
  THREE,
  tapClient(x: number, y: number) {
    ;(game as any).handleTap(x, y)
  },
  // Tap a world position by projecting it to screen space first.
  tapWorld(x: number, y: number, z: number) {
    const p = game.worldToRt(new THREE.Vector3(x, y, z))
    const c = game.pipeline.rtToClient(p.x, p.y)
    ;(game as any).handleTap(c.x, c.y)
  },
  // Debug: jump directly to a scene by id.
  jumpTo(id: string) {
    const builders: Record<string, () => GameScene> = {
      field: buildField,
      chapel: buildChapel,
      tower: buildTower,
      door: buildDoor,
    }
    sceneIndex = CHAIN.findIndex((b) => b === builders[id])
    game.travelTo(builders[id])
  },
}
