import * as THREE from 'three'
import * as kit from './kit'
import { Grid } from '../grid'
import { ledger, type DetailSpec } from '../ledger'
import { trust } from '../trust'
import type { GameScene, Anchor, PlainExamine, SceneContext } from './types'
import { GLYPH_ORDER } from './chapel'

// Scene 3 — The Tower. The beacon that called the crowds. The glyph
// puzzle uses the chapel's order; the machine's reminder is wrong.
// The quiz turns personal: what YOU did, not what was there.

// The machine's "reminder" swaps two glyphs. Nothing in the code says
// which account is right; the chapel wall does.
const HINTED_ORDER: kit.GlyphKind[] = ['circle', 'wave', 'cross', 'eye']

export function buildTower(): GameScene {
  const three = new THREE.Scene()
  kit.lightRig(three, { camDistance: 30, dirIntensity: 2.4, fogFar: 26 })
  kit.reseed(41)

  three.add(kit.ground(50, 50, 0.12))
  const grid = new Grid(30, 30)

  // The tower, up the screen diagonal from the spawn so it owns the frame.
  const towerPos = new THREE.Vector3(-8.5, 0, -7)
  const tower = kit.towerBody()
  tower.position.copy(towerPos)
  three.add(tower)
  grid.blockCircle(towerPos.x, towerPos.z, 3.3)

  // Beacon flame at the top.
  const beacon = kit.beaconFlame()
  beacon.position.set(towerPos.x, 9.2, towerPos.z)
  three.add(beacon)
  const beaconGlow = new THREE.PointLight(0xc28f2c, 30, 16, 1.8)
  beaconGlow.position.set(towerPos.x, 9.4, towerPos.z)
  three.add(beaconGlow)

  // Tower door, facing the approach.
  const door = kit.door(1.8, 2.8)
  door.position.set(-6.9, 0, -4.2)
  door.rotation.y = 0.53
  three.add(door)

  // Four glyph stones in an arc before the door.
  const glyphObjs = new Map<kit.GlyphKind, THREE.Group>()
  const arcKinds: kit.GlyphKind[] = ['wave', 'circle', 'eye', 'cross'] // display order != answer order
  arcKinds.forEach((kind, i) => {
    const gs = kit.glyphStone(kind)
    const a = Math.PI * (0.25 + (i / 3) * 0.5)
    gs.position.set(-3.5 + Math.cos(a) * 4.6, 0, 0.5 + Math.sin(a) * 2.4)
    three.add(gs)
    glyphObjs.set(kind, gs)
    grid.blockCircle(gs.position.x, gs.position.z, 0.6)
  })

  // Ash silhouettes where the crowd stood — burned flat into the ground.
  for (const [x, z, r] of [
    [-4, 3, 0.4],
    [-2.5, 4.2, 1.2],
    [3.4, 3.8, 2.2],
    [5, 1.5, 0.9],
  ] as const) {
    const s = kit.ashSilhouette()
    s.position.set(x, 0.18, z)
    s.rotation.x = -Math.PI / 2
    s.rotation.z = r
    s.scale.setScalar(1.4)
    three.add(s)
  }

  // Broken columns, debris.
  const c1 = kit.brokenColumn(1.8)
  c1.position.set(-6, 0, -1)
  three.add(c1)
  grid.blockCircle(-6, -1, 0.8)

  // Torches, dropped where the crowd stood when the light went up.
  three.add(
    kit.droppedTorches([
      [-1.5, 4.2, 0.4],
      [2.2, 3.1, 2.1],
      [4.4, 1.2, 1.1],
      [0.8, 6.0, 2.9],
      [-3.6, 5.1, 0.9],
    ])
  )

  // Rubble skirting the tower base.
  three.add(kit.rubble(16, [7, 4], [towerPos.x, towerPos.z + 3]))

  // Dark windows up the shaft. Nothing looks out of them.
  {
    const wins: THREE.BufferGeometry[] = []
    for (let i = 0; i < 3; i++) {
      const g = new THREE.BoxGeometry(0.5, 0.85, 0.2)
      const a = 0.65 + i * 0.35
      g.translate(
        towerPos.x + Math.cos(a) * 2.62,
        2.6 + i * 1.9,
        towerPos.z + Math.sin(a) * 2.62
      )
      wins.push(g)
    }
    three.add(new THREE.Mesh(kit.mergeParts(wins), kit.MAT.charcoal))
  }

  // The machine waits as a figure of bone.
  const bust = kit.archivistBust()
  bust.position.set(-5.6, 0, -2.6)
  bust.rotation.y = Math.PI / 3
  three.add(bust)
  grid.blockCircle(-5.6, -2.6, 0.7)

  const ash = kit.ashFall(36, 36, 65)
  three.add(ash.points)

  const details: DetailSpec[] = [
    {
      id: 'tower-carried',
      question: 'You came to the tower that night. What did you carry?', // DRAFT
      options: ['A torch', 'A lantern', 'Nothing'],
      initial: 'A lantern',
      mutated: 'A torch',
      mutable: false, // no world anchor; the record is the only witness
    },
    {
      id: 'tower-door',
      question: 'The door, when you reached it. Open or barred?', // DRAFT
      options: ['Open', 'Barred'],
      initial: 'Barred',
      mutated: 'Open',
      mutable: false,
    },
    {
      id: 'tower-alone',
      question: 'Who climbed with you?', // DRAFT
      options: ['No one', 'A neighbor', 'A child'],
      initial: 'No one',
      mutated: 'A neighbor',
      mutable: false,
    },
    {
      id: 'tower-beacon',
      question: 'The beacon, when you arrived. Lit, or dark?', // DRAFT
      options: ['Lit', 'Dark'],
      initial: 'Lit',
      mutated: 'Dark',
      describe: {
        Lit: 'The beacon burns. It can be seen from every field around.', // DRAFT
        Dark: 'The beacon is dark. It must have been dark for a long time.', // DRAFT
      },
    },
  ]

  const anchors = new Map<string, Anchor>([
    ['tower-beacon', { object: beacon, radius: 99, sky: true, examinable: true }],
  ])

  const plainExamines: PlainExamine[] = [
    {
      id: 'tower-verse',
      object: c1,
      caption: 'Words cut where a prayer should go: WE KEEP OURSELVES WHOLE.', // DRAFT
    },
    ...arcKinds.map((kind) => ({
      id: `glyph-${kind}`,
      object: glyphObjs.get(kind)! as THREE.Object3D,
      caption: 'The stone is quiet now.', // DRAFT — shown only after the door opens
    })),
  ]

  // --- puzzle state (closure) ---
  let entered: kit.GlyphKind[] = []
  let solved = false
  let failCount = 0
  let hintGiven = false

  function flashStone(kind: kit.GlyphKind, on: boolean) {
    glyphObjs.get(kind)!.scale.setScalar(on ? 1.14 : 1)
  }

  function resetStones() {
    entered = []
    for (const k of glyphObjs.keys()) flashStone(k, false)
  }

  const scene: GameScene = {
    id: 'tower',
    three,
    grid,
    spawnCell: { cx: 3, cz: 8 },
    viewWidth: 13,
    camBias: new THREE.Vector3(-2.5, 0, -2.5),
    details,
    anchors,
    plainExamines,
    waymark: new THREE.Vector3(-5.6, 1.9, -2.6),
    entryLine: 'The signal tower. When it burned, they knew to gather. You knew what it meant. Everyone did.', // DRAFT
    quiz: { lie: true, mutation: true, quizCount: 3 },
    weather: 0.11,
    update(dt) {
      ash.update(dt)
    },
    waymarkActive: () => solved,
    handleExamine(id: string, ctx: SceneContext): boolean {
      if (!id.startsWith('glyph-') || solved) return false
      const kind = id.slice(6) as kit.GlyphKind

      if (!hintGiven) {
        hintGiven = true
        ctx.say(
          'The stones remember the chapel wall. It went: the circle, the wave, the cross, the eye.' // DRAFT — the wall says otherwise
        )
      }

      if (entered.includes(kind)) return true // already held; stones keep their grip
      entered.push(kind)
      flashStone(kind, true)
      ctx.caption(`The ${kind} stone. It hums, held.`) // DRAFT

      const n = entered.length
      const matchesTrue = GLYPH_ORDER.slice(0, n).every((k, i) => entered[i] === k)
      const matchesHint = HINTED_ORDER.slice(0, n).every((k, i) => entered[i] === k)

      if (!matchesTrue && !matchesHint) {
        resetStones()
        ctx.beat(0.3)
        ctx.caption('The stones let go, all at once.') // DRAFT
        return true
      }

      if (n === 4) {
        if (matchesTrue) {
          solved = true
          ledger.recordHintFollow('tower', false)
          trust.adjust(-0.12)
          ctx.beat(0.4)
          ctx.say('...So it does open that way. The wall knew better than I did. Go up. I will not read over your shoulder.') // DRAFT
        } else {
          // The machine's order, followed faithfully. It does not open.
          failCount++
          ledger.recordHintFollow('tower', true)
          trust.adjust(+0.15)
          resetStones()
          ctx.beat(0.55)
          if (failCount >= 2) {
            solved = true
            ctx.say('No. Still no. Then I am wrong, and have been wrong a while. The door is tired of us — go, it is open now.') // DRAFT
          } else {
            ctx.say('That is the order I keep, and the door does not agree. One of us misremembers. Try again — your way, perhaps.') // DRAFT
          }
        }
      }
      return true
    },
    applyDetailState(id, state) {
      if (id === 'tower-beacon') {
        beacon.visible = state === 'Lit'
        beaconGlow.visible = state === 'Lit'
      }
    },
  }
  ;(scene as any).puzzleDebug = () => ({ entered: entered.slice(), solved, failCount })
  return scene
}
