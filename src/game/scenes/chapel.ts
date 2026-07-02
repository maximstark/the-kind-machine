import * as THREE from 'three'
import * as kit from './kit'
import { Grid } from '../grid'
import type { DetailSpec } from '../ledger'
import type { GameScene, Anchor, PlainExamine } from './types'

// Scene 2 — The Chapel. First lie, still small. First mid-scene mutation.
// First culpability detail, unremarked: a chalk mark on a door, in a hand
// that might be yours. The glyph wall here is the key to the Tower.

export const GLYPH_ORDER: kit.GlyphKind[] = ['circle', 'cross', 'wave', 'eye']

export function buildChapel(): GameScene {
  const three = new THREE.Scene()
  kit.lightRig(three, { camDistance: 30, dirIntensity: 2.6, fogFar: 19 })
  kit.reseed(23)

  three.add(kit.ground(46, 46, 0.08))
  const grid = new Grid(26, 26)

  // Nave walls, roofless. Camera-side walls are low sills so the iso
  // camera sees in; far walls carry the height.
  const wallW = kit.wall(12, 3.2)
  wallW.position.set(-4.5, 0, -1)
  wallW.rotation.y = Math.PI / 2
  const wallE = kit.wall(12, 0.7)
  wallE.position.set(4.5, 0, -1)
  wallE.rotation.y = Math.PI / 2
  const wallN = kit.wall(9.4, 3.6)
  wallN.position.set(0, 0, -7)
  three.add(wallW, wallE, wallN)
  for (let z = -7; z <= 5; z++) {
    grid.blockCircle(-4.5, z, 0.5)
    grid.blockCircle(4.5, z, 0.5)
  }
  for (let x = -4; x <= 4; x++) grid.blockCircle(x, -7, 0.5)

  // Pews, two ranks.
  let firstPew: THREE.Group | null = null
  for (let i = 0; i < 3; i++) {
    const l = kit.pew()
    l.position.set(-2.2, 0, 1.6 - i * 1.5)
    const r = kit.pew()
    r.position.set(2.2, 0, 1.6 - i * 1.5)
    three.add(l, r)
    if (!firstPew) firstPew = l
    grid.blockCircle(-2.2, 1.6 - i * 1.5, 0.8)
    grid.blockCircle(2.2, 1.6 - i * 1.5, 0.8)
  }

  // Altar and candles.
  const altar = kit.altar()
  altar.position.set(0, 0, -5.6)
  three.add(altar)
  grid.blockCircle(0, -5.6, 1.2)
  const candles = kit.candleRow(5)
  candles.group.position.set(0, 1.05, -5.6)
  three.add(candles.group)
  candles.setCount(3)
  const candleGlow = new THREE.PointLight(0xc28f2c, 10, 7, 1.8)
  candleGlow.position.set(0, 1.8, -5.2)
  three.add(candleGlow)

  // The statue behind the altar.
  const statue = kit.figureStatue(2.6)
  statue.position.set(0, 0.4, -6.6)
  statue.rotation.y = Math.PI // facing away (toward the wall)
  three.add(statue)

  // Side door with the chalk mark and a ribbon.
  const sideDoor = kit.door(1.4, 2.4)
  sideDoor.position.set(-4.4, 0, 2.8)
  sideDoor.rotation.y = Math.PI / 2
  three.add(sideDoor)
  const mark = kit.chalkMark()
  mark.position.set(-4.25, 1.5, 2.8)
  mark.rotation.y = Math.PI / 2
  three.add(mark)
  const ribbonGold = kit.ribbon(true)
  ribbonGold.position.set(-4.22, 1.0, 2.25)
  ribbonGold.rotation.y = Math.PI / 2
  const ribbonBone = kit.ribbon(false)
  ribbonBone.position.copy(ribbonGold.position)
  ribbonBone.rotation.copy(ribbonGold.rotation)
  ribbonBone.visible = false
  three.add(ribbonGold, ribbonBone)

  // Glyph wall: four sculptures along the north wall. The order matters
  // later; nothing here says so.
  const glyphGroup = new THREE.Group()
  GLYPH_ORDER.forEach((kind, i) => {
    const gs = kit.glyphStone(kind)
    gs.position.set(-3 + i * 2, 0, -6.4)
    gs.scale.setScalar(0.8)
    glyphGroup.add(gs)
    grid.blockCircle(-3 + i * 2, -6.4, 0.5)
  })
  three.add(glyphGroup)

  // A cold brazier outside the entrance.
  const torch = kit.torch(false)
  torch.position.set(1.5, 0, 6.5)
  three.add(torch)

  const details: DetailSpec[] = [
    {
      id: 'chapel-candles',
      question: 'The candles on the altar. How many burned?', // DRAFT
      options: ['Three', 'Four', 'Five'],
      initial: 'Three',
      mutated: 'Five',
      describe: {
        Three: 'Candles on the altar. Three of them, burning low.', // DRAFT
        Five: 'Candles on the altar. Five of them, burning low.', // DRAFT
      },
    },
    {
      id: 'chapel-ribbon',
      question: 'A ribbon was tied by the side door. What color?', // DRAFT
      options: ['Gold', 'Bone-white'],
      initial: 'Gold',
      mutated: 'Bone-white',
      describe: {
        Gold: 'A ribbon by the door, tied in a hurry. Gold.', // DRAFT
        'Bone-white': 'A ribbon by the door, tied in a hurry. Bone-white.', // DRAFT
      },
    },
    {
      id: 'chapel-statue',
      question: 'The figure behind the altar. Which way did it face?', // DRAFT
      options: ['Toward you', 'Away from you'],
      initial: 'Away from you',
      mutated: 'Toward you',
      describe: {
        'Away from you': 'A figure in stone, turned to the wall.', // DRAFT
        'Toward you': 'A figure in stone. It faces the room now — or it always did.', // DRAFT
      },
    },
    {
      id: 'chapel-pews',
      question: 'The benches. How many rows on each side?', // DRAFT
      options: ['Two', 'Three', 'Four'],
      initial: 'Three',
      mutated: 'Two',
      mutable: false, // removing furniture mid-scene reads as a bug, not a doubt
    },
  ]

  const anchors = new Map<string, Anchor>([
    ['chapel-candles', { object: candles.group, radius: 6, examinable: true }],
    ['chapel-ribbon', { object: ribbonGold, radius: 5, examinable: true }],
    ['chapel-statue', { object: statue, radius: 7, examinable: true }],
    ['chapel-pews', { object: firstPew!, radius: 7 }],
  ])

  const plainExamines: PlainExamine[] = [
    {
      id: 'chapel-mark',
      object: mark,
      caption: 'A chalk mark on the door. A circle, crossed. The hand was steady.', // DRAFT
    },
    {
      id: 'chapel-glyphs',
      object: glyphGroup,
      caption: 'Four shapes, carved with care: the circle, the cross, the wave, the eye.', // DRAFT
    },
  ]

  return {
    id: 'chapel',
    three,
    grid,
    spawnCell: { cx: 0, cz: 8 },
    viewWidth: 11,
    details,
    anchors,
    plainExamines,
    waymark: new THREE.Vector3(0, 0.4, 4.2),
    entryLine: 'The chapel. They brought their fears here first, before they brought each other.', // DRAFT
    quiz: { lie: true, mutation: true, quizCount: 3 },
    weather: 0.05,
    applyDetailState(id, state) {
      if (id === 'chapel-candles') candles.setCount(state === 'Five' ? 5 : state === 'Four' ? 4 : 3)
      if (id === 'chapel-ribbon') {
        ribbonGold.visible = state === 'Gold'
        ribbonBone.visible = state !== 'Gold'
      }
      if (id === 'chapel-statue') {
        statue.rotation.y = state === 'Toward you' ? 0 : Math.PI
      }
    },
  }
}
