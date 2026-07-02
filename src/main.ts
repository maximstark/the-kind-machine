import * as THREE from 'three'
import { Pipeline } from './core/pipeline'
import { IsoRig } from './core/isoCamera'
import { atmosphere } from './core/atmosphere'
import { Overlay } from './ui/overlay'
import * as kit from './game/scenes/kit'

// M1 graybox: judge the pixel/dither pipeline before anything else is built.

const canvas = document.getElementById('game') as HTMLCanvasElement
const pipeline = new Pipeline(canvas)
const rig = new IsoRig()
const overlay = new Overlay(pipeline)

rig.setAspect(pipeline.rtWidth / pipeline.rtHeight)
pipeline.onResize = (w, h) => rig.setAspect(w / h)

function buildGraybox(): THREE.Scene {
  const scene = new THREE.Scene()
  kit.lightRig(scene, { camDistance: rig.distance })
  kit.reseed(7)

  scene.add(kit.ground(40, 40))

  const stonePositions: [number, number][] = [
    [-4.5, -2], [-2.5, 3.5], [1.5, -4], [4, 2], [6, -1.5], [-6, 1], [2.5, 5.5], [-1, -6.5],
  ]
  for (const [x, z] of stonePositions) {
    const s = kit.standingStone(1.2 + Math.random() * 1.4)
    s.position.x = x
    s.position.z = z
    scene.add(s)
  }

  const col = kit.brokenColumn(2.6)
  col.position.set(-3, 0, -4.5)
  scene.add(col)

  scene.add(kit.footprints(new THREE.Vector3(-8, 0, 6), new THREE.Vector3(6, 0, -6), 16))

  const t1 = kit.torch(true)
  t1.position.set(3.5, 0, 0.5)
  scene.add(t1)
  const t2 = kit.torch(false)
  t2.position.set(-5, 0, 4)
  scene.add(t2)

  const moon1 = kit.moon(1.0)
  moon1.position.set(-6, 7, -2)
  const moon2 = kit.moon(0.5)
  moon2.position.set(-2.5, 6.0, -4.5)
  scene.add(moon1, moon2)

  const player = kit.pawn()
  player.position.set(0, 0, 0)
  scene.add(player)

  // Moons should face the camera.
  moon1.lookAt(rig.cam.position)
  moon2.lookAt(rig.cam.position)

  return scene
}

rig.distance = 30
rig.frameWidth(new THREE.Vector3(0, 0.5, 0), 11)
const scene = buildGraybox()

let last = performance.now()
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  const t = now / 1000

  atmosphere.update(dt, t)
  pipeline.disturb = atmosphere.amplitude

  overlay.clear()
  overlay.machineText('You are awake. Good. Walk with me a while.') // DRAFT
  overlay.caption('A standing stone. Someone leaned here, once.') // DRAFT

  pipeline.render(scene, rig.cam, t)
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

// Debug surface for automated verification.
;(window as any).__tkm = {
  pipeline,
  rig,
  atmosphere,
}
