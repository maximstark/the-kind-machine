import * as THREE from 'three'
import * as kit from './kit'
import { Grid } from '../grid'
import { ledger, type DetailSpec } from '../ledger'
import { trust } from '../trust'
import type { GameScene, PlainExamine, SceneContext } from './types'

// Scene 4 — The Door. The monumental hall. The machine assembles its
// account of the final day from the ledger — including the wrong answers
// it fed you — and asks you to choose whose memory stands.

export function buildDoor(): GameScene {
  const three = new THREE.Scene()
  const rigLights = kit.lightRig(three, {
    camDistance: 30,
    dirIntensity: 1.7,
    fogNear: 4,
    fogFar: 46,
  })
  kit.reseed(77)

  three.add(kit.ground(44, 84, 0.05))
  const grid = new Grid(24, 66)

  // Colonnades down the length of the hall.
  for (let i = 0; i < 8; i++) {
    const z = 16 - i * 6
    const l = kit.column(14, 0.8)
    l.position.set(-7, 0, z)
    const r = kit.column(14, 0.8)
    r.position.set(7, 0, z)
    three.add(l, r)
    grid.blockCircle(-7, z, 1.1)
    grid.blockCircle(7, z, 1.1)
  }

  // The ceiling of bodies. Backlit masses; never resolving.
  three.add(kit.ceilingMasses(110, [24, 66], 18.5))

  // The door, vast, at the far end.
  const door = kit.door(7, 12)
  door.position.set(0, 0, -30)
  three.add(door)
  const frameL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 13, 0.6), kit.MAT.gold)
  frameL.position.set(-3.9, 6.5, -30)
  const frameR = frameL.clone()
  frameR.position.x = 3.9
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 0.6), kit.MAT.gold)
  lintel.position.set(0, 12.8, -30)
  three.add(frameL, frameR, lintel)
  for (let x = -4; x <= 4; x++) grid.blockCircle(x, -30, 0.6)

  // The god-beam, from the tear in the ceiling to the threshold.
  const beam = kit.godBeam(19, 4.2)
  beam.position.set(0, 9.5, -26)
  three.add(beam)
  const beamGlow = new THREE.PointLight(0xe8dfc9, 26, 22, 1.9)
  beamGlow.position.set(0, 6, -26)
  three.add(beamGlow)

  // Small human wreckage on the way down.
  const censer = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 8), kit.MAT.gold)
  censer.rotation.z = Math.PI / 2
  censer.position.set(-3.4, 0.35, 4)
  three.add(censer)

  const chalkPile = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 5), kit.MAT.bone)
    stub.position.set((i % 3) * 0.2 - 0.2, 0.06, Math.floor(i / 3) * 0.2)
    stub.rotation.z = Math.PI / 2 + i
    chalkPile.add(stub)
  }
  chalkPile.position.set(2.8, 0, -8)
  three.add(chalkPile)

  const details: DetailSpec[] = []

  const plainExamines: PlainExamine[] = [
    {
      id: 'door-censer',
      object: censer,
      caption: 'A censer, toppled. The ash inside kept its shape.', // DRAFT
    },
    {
      id: 'door-chalk',
      object: chalkPile,
      caption: 'Chalk, worn to stubs. Enough for every door in town, and to spare.', // DRAFT
    },
    {
      id: 'door-door',
      object: door,
      caption: 'It is only a door. It was always only a door.', // DRAFT
    },
  ]

  // --- the assembly ---

  function assemble(ctx: SceneContext) {
    const recs = ledger.quiz
    const agreements = recs.filter((r) => r.agreedWithMachine).length
    const followedHint = ledger.hintFollows.some((h) => h.followedMachine)
    const sawMark = ledger.examines.some((e) => e.targetId === 'chapel-mark')
    const carried = ledger.quiz.find((q) => q.detailId === 'tower-carried')
    const carriedThing = (carried?.agreedWithMachine ? carried.machineClaim : carried?.playerAnswer) ?? 'a lantern'

    const lines: string[] = []
    lines.push('Here, then. The last of it. Let me read the day back to you.') // DRAFT
    lines.push('You crossed the field with the others. The prints in the ash are one set among many, and one set of them is yours.') // DRAFT
    if (sawMark) {
      lines.push('You saw the mark on the chapel door. You knew the shape. You did not ask whose hand drew it.') // DRAFT
    } else {
      lines.push('You passed the chapel door without looking at it. There was a mark there. You knew without looking.') // DRAFT
    }
    lines.push(`You carried ${carriedThing.toLowerCase()} to the tower, the night the beacon burned.`) // DRAFT
    if (followedHint) {
      lines.push('At the stones you trusted my order over your own eyes. You have done that before. It was easier the second time.') // DRAFT
    }
    if (agreements >= recs.length / 2) {
      lines.push('Between us we kept a tidy record. You agreed with me often. I am grateful. Agreement is how a day becomes true.') // DRAFT
    } else {
      lines.push('You argued with my record at every turn. That is all right. The ones who argued longest stayed outside the longest.') // DRAFT
    }
    lines.push('My account of the final day says you were afraid, and you helped. Your account says you were afraid, and you watched.') // DRAFT
    lines.push('Both are built from the same fragments. I cannot keep both.') // DRAFT

    let i = 0
    const next = () => {
      if (i < lines.length) {
        ctx.say(lines[i++], { onDone: next })
      } else {
        ctx.say('Choose whose memory stands.', {
          // DRAFT
          hold: 999,
        })
        ctx.choice(['Let its account stand', 'Keep your own'], (picked) => {
          if (picked === 'Let its account stand') {
            trust.adjust(+0.3)
            applyEnding('accept')
            ctx.say('Then it is settled, and settled gently. No one did anything that was not done by everyone.', {
              // DRAFT
              onDone: () => ctx.endGame('accept'),
            })
          } else {
            trust.adjust(-0.3)
            applyEnding('keep')
            ctx.say('Then keep it. Carry it. It is heavier, the way you hold it.', {
              // DRAFT
              onDone: () => ctx.endGame('keep'),
            })
          }
        })
      }
    }
    next()
  }

  function applyEnding(kind: 'accept' | 'keep') {
    if (kind === 'accept') {
      // Clean, bright, absolved. The only moment the weather fully clears.
      rigLights.dir.intensity = 3.6
      rigLights.hemi.intensity = 1.7
      three.fog = new THREE.Fog(0x131118, 60, 160)
      ;(beam.material as THREE.MeshBasicMaterial).opacity = 0.34
      beamGlow.intensity = 60
    } else {
      rigLights.dir.intensity = 1.3
      ;(beam.material as THREE.MeshBasicMaterial).opacity = 0.1
      beamGlow.intensity = 12
    }
  }

  return {
    id: 'door',
    three,
    grid,
    spawnCell: { cx: 0, cz: 30 },
    viewWidth: 26,
    camBias: new THREE.Vector3(0, 0, -7),
    details,
    anchors: new Map(),
    plainExamines,
    waymark: new THREE.Vector3(0, 0.6, -25),
    entryLine: 'This is the hall. I have kept it the size it felt, not the size it was. Come to the light.', // DRAFT
    quiz: { lie: false, mutation: false },
    weather: 0.18,
    finale: assemble,
    applyDetailState() {},
  }
}
