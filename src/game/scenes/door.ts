import * as THREE from 'three'
import * as kit from './kit'
import { Grid } from '../grid'
import { ledger, type DetailSpec } from '../ledger'
import { trust } from '../trust'
import type { GameScene, PlainExamine, SceneContext } from './types'

// Scene 4 — The Door. The monumental hall. The machine assembles its
// account of the final day from the ledger — including the wrong answers
// it fed you — and asks you to choose whose memory stands.
//
// The hall runs along the screen-up diagonal so the whole walk reads
// vertically in portrait: a lone tiny figure, a vast hall, one beam.

const AXIS_U = new THREE.Vector3(-Math.SQRT1_2, 0, -Math.SQRT1_2) // up the screen
const AXIS_R = new THREE.Vector3(Math.SQRT1_2, 0, -Math.SQRT1_2) // screen right

function P(s: number, w: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3()
    .addScaledVector(AXIS_U, s)
    .addScaledVector(AXIS_R, w)
    .setY(y)
}

export function buildDoor(): GameScene {
  const three = new THREE.Scene()
  const rigLights = kit.lightRig(three, {
    camDistance: 30,
    dirIntensity: 1.7,
    fogNear: 4,
    fogFar: 46,
  })
  kit.reseed(77)

  three.add(kit.ground(110, 110, 0.05))
  const grid = new Grid(90, 90)

  // Colonnades down the length of the hall.
  for (let i = 0; i < 8; i++) {
    const s = 8 + i * 5.5
    for (const w of [-7, 7]) {
      const col = kit.column(14, 0.8)
      col.position.copy(P(s, w))
      three.add(col)
      grid.blockCircle(col.position.x, col.position.z, 1.1)
    }
  }

  // The ceiling of bodies, rotated to hang over the hall's axis.
  const masses = kit.ceilingMasses(110, [24, 72], 18.5)
  masses.rotation.y = Math.PI / 4
  three.add(masses)

  // The door, vast, at the far end, facing back down the hall.
  const doorPos = P(46, 0)
  const door = kit.door(7, 12)
  door.position.copy(doorPos)
  door.rotation.y = Math.PI / 4
  three.add(door)
  const frameGeo = new THREE.BoxGeometry(0.5, 13, 0.6)
  const frameL = new THREE.Mesh(frameGeo, kit.MAT.gold)
  frameL.position.copy(P(46, -3.9, 6.5))
  frameL.rotation.y = Math.PI / 4
  const frameR = new THREE.Mesh(frameGeo, kit.MAT.gold)
  frameR.position.copy(P(46, 3.9, 6.5))
  frameR.rotation.y = Math.PI / 4
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.5, 0.6), kit.MAT.gold)
  lintel.position.copy(P(46, 0, 12.8))
  lintel.rotation.y = Math.PI / 4
  three.add(frameL, frameR, lintel)
  for (let w = -4; w <= 4; w++) {
    const b = P(46, w)
    grid.blockCircle(b.x, b.z, 0.8)
  }

  // The god-beam, from the tear in the ceiling to the threshold.
  const beam = kit.godBeam(19, 4.2)
  beam.position.copy(P(41, 0, 9.5))
  three.add(beam)
  let beamBaseOpacity = 0.16
  const beamGlow = new THREE.PointLight(0xe8dfc9, 26, 22, 1.9)
  beamGlow.position.copy(P(41, 0, 6))
  three.add(beamGlow)

  // Small human wreckage on the way down.
  const censer = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 8), kit.MAT.gold)
  censer.rotation.z = Math.PI / 2
  censer.position.copy(P(9, -3.4, 0.35))
  three.add(censer)

  const chalkPile = new THREE.Group()
  for (let i = 0; i < 5; i++) {
    const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.28, 5), kit.MAT.bone)
    stub.position.set((i % 3) * 0.2 - 0.2, 0.06, Math.floor(i / 3) * 0.2)
    stub.rotation.z = Math.PI / 2 + i
    chalkPile.add(stub)
  }
  chalkPile.position.copy(P(22, 2.8))
  three.add(chalkPile)

  // A pale runner down the axis: the walk the eye is meant to take.
  const runnerGeo = new THREE.PlaneGeometry(3.2, 62)
  runnerGeo.rotateX(-Math.PI / 2)
  const runner = new THREE.Mesh(
    runnerGeo,
    new THREE.MeshLambertMaterial({ color: 0x6d6f76 })
  )
  runner.position.copy(P(21, 0, 0.12))
  runner.rotation.y = Math.PI / 4
  three.add(runner)

  // Columns that fell across the walk. You go around what came down.
  for (const [s, w, yawOff] of [
    [16, -1.5, 0.15],
    [30, 2, -0.2],
  ] as const) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.8, 7.5, 8), kit.MAT.stone)
    const pos = P(s, w)
    seg.position.copy(pos).setY(0.75)
    seg.rotation.z = Math.PI / 2
    seg.rotation.y = Math.PI / 4 + Math.PI / 2 + yawOff
    three.add(seg)
    // Block a short line of cells across the segment.
    for (let k = -3; k <= 3; k++) {
      const b = P(s, w + k)
      grid.blockCircle(b.x, b.z, 0.7)
    }
  }

  // Candle banks flanking the threshold.
  const bankL = kit.candleBank(7)
  bankL.position.copy(P(43.5, -4.2))
  const bankR = kit.candleBank(7)
  bankR.position.copy(P(43.5, 4.2))
  three.add(bankL, bankR)

  const ash = kit.ashFall(34, 60, 60, { height: 16, speed: 0.4 })
  ash.points.rotation.y = Math.PI / 4
  ash.points.position.copy(P(22, 0))
  three.add(ash.points)

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
      beamBaseOpacity = 0.34
      beamGlow.intensity = 60
    } else {
      rigLights.dir.intensity = 1.3
      beamBaseOpacity = 0.1
      beamGlow.intensity = 12
    }
  }

  const spawnCell = grid.worldToCell(P(0, 0))

  return {
    id: 'door',
    three,
    grid,
    spawnCell,
    viewWidth: 14,
    camBias: new THREE.Vector3().addScaledVector(AXIS_U, 6),
    // The pullback: human-scale at the threshold, monumental at the door.
    viewWidthAt(p: THREE.Vector3) {
      const s = p.dot(AXIS_U)
      const t = Math.min(1, Math.max(0, s / 38))
      return 14 + t * 17
    },
    details,
    anchors: new Map(),
    plainExamines,
    waymark: P(40, 0, 0.6),
    entryLine: 'This is the hall. I have kept it the size it felt, not the size it was. Come to the light.', // DRAFT
    quiz: { lie: false, mutation: false },
    weather: 0.18,
    finale: assemble,
    applyDetailState() {},
    update(dt: number, t: number) {
      ash.update(dt)
      // Dither-sparkle inside the beam: cheap flicker, never still.
      const m = beam.material as THREE.MeshBasicMaterial
      const flicker = 0.02 * Math.sin(t * 9.7) + 0.015 * Math.sin(t * 23.3 + 1.7)
      m.opacity = Math.max(0.05, beamBaseOpacity + flicker)
    },
  }
}
