import * as THREE from 'three'
import * as kit from './kit'
import { Grid } from '../grid'
import type { DetailSpec } from '../ledger'
import type { GameScene, Anchor, PlainExamine } from './types'

// Scene 1 — The Field. Tutorial. Machine warm, accurate, trustworthy.
// Details are innocent: moons, stones, a torch, footprints.

export function buildField(): GameScene {
  const three = new THREE.Scene()
  kit.lightRig(three, { camDistance: 30 })
  kit.reseed(7)

  three.add(kit.ground(44, 44))
  const grid = new Grid(30, 30)

  // Stone ring: seven stones; an eighth rises only if the world decides so.
  const stoneRing: THREE.Mesh[] = []
  const ringCenter = { x: -1, z: -1 }
  const ringR = 4.6
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.4
    const s = kit.standingStone(1.3 + (i % 3) * 0.4)
    s.position.x = ringCenter.x + Math.cos(a) * ringR
    s.position.z = ringCenter.z + Math.sin(a) * ringR
    three.add(s)
    stoneRing.push(s)
    grid.blockCircle(s.position.x, s.position.z, 0.7)
  }
  stoneRing[7].visible = false // the eighth

  // Two moons.
  const moon1 = kit.moon(1.0)
  moon1.position.set(-6, 7, -2)
  const moon2 = kit.moon(0.5)
  moon2.position.set(-2.5, 6.0, -4.5)
  three.add(moon1, moon2)

  // The torch by the path.
  const torchPos = new THREE.Vector3(3.5, 0, 2.5)
  const torchLit = kit.torch(true)
  torchLit.position.copy(torchPos)
  const torchCold = kit.torch(false)
  torchCold.position.copy(torchPos)
  torchCold.visible = false
  three.add(torchLit, torchCold)
  grid.blockCircle(torchPos.x, torchPos.z, 0.5)

  // The procession's footprints. Two layouts, one visible.
  const printsFrom = new THREE.Vector3(-9, 0, 7)
  const printsTo = new THREE.Vector3(7, 0, -7)
  const printsToward = kit.footprints(printsFrom, printsTo, 18)
  const printsAway = kit.footprints(printsTo, printsFrom, 18)
  printsAway.visible = false
  three.add(printsToward, printsAway)

  // A broken column to lean the world against.
  const col = kit.brokenColumn(2.4)
  col.position.set(-5.5, 0, 3.5)
  three.add(col)
  grid.blockCircle(-5.5, 3.5, 0.8)

  // An ash silhouette against the column — the first unremarked detail.
  const sil = kit.ashSilhouette()
  sil.position.set(-5.05, 0.1, 3.5)
  sil.rotation.y = Math.PI / 2.6
  three.add(sil)

  const details: DetailSpec[] = [
    {
      id: 'field-moons',
      question: 'How many moons hung over the field?', // DRAFT
      options: ['One', 'Two', 'Three'],
      initial: 'Two',
      mutated: 'One',
      sky: true,
    },
    {
      id: 'field-stones',
      question: 'The stones in the ring. How many did you count?', // DRAFT
      options: ['Six', 'Seven', 'Eight'],
      initial: 'Seven',
      mutated: 'Eight',
      describe: {
        Seven: 'Standing stones. You count seven.', // DRAFT
        Eight: 'Standing stones. You count eight.', // DRAFT
      },
    },
    {
      id: 'field-torch',
      question: 'The torch by the path. Was it burning?', // DRAFT
      options: ['It was burning', 'It was cold'],
      initial: 'It was burning',
      mutated: 'It was cold',
      describe: {
        'It was burning': 'A torch, dropped mid-stride. Still burning.', // DRAFT
        'It was cold': 'A torch, dropped mid-stride. Long cold.', // DRAFT
      },
    },
    {
      id: 'field-prints',
      question: 'The footprints. Which way did they lead?', // DRAFT
      options: ['Toward the chapel', 'Away from the chapel'],
      initial: 'Toward the chapel',
      mutated: 'Away from the chapel',
      describe: {
        'Toward the chapel': 'Footprints in the ash. Many. All walking toward the chapel.', // DRAFT
        'Away from the chapel': 'Footprints in the ash. Many. All walking away from the chapel.', // DRAFT
      },
    },
  ]

  const anchors = new Map<string, Anchor>([
    ['field-moons', { object: moon1, radius: 99, sky: true }],
    ['field-stones', { object: stoneRing[0], radius: 8, examinable: true }],
    ['field-torch', { object: torchLit, radius: 5, examinable: true }],
    ['field-prints', { object: printsToward, radius: 6, examinable: true }],
  ])

  const plainExamines: PlainExamine[] = [
    {
      id: 'field-silhouette',
      object: col,
      caption: 'A shape against the column, printed in ash. About your height.', // DRAFT
    },
  ]

  return {
    id: 'field',
    three,
    grid,
    spawnCell: { cx: -7, cz: 6 },
    viewWidth: 11,
    details,
    anchors,
    plainExamines,
    waymark: new THREE.Vector3(8, 0.4, -5),
    entryLine: 'You are awake. Good. This is the field, as well as I remember it. Walk. Look. I will ask you to help me with the details.', // DRAFT
    quiz: { lie: false, mutation: false, quizCount: 3 },
    applyDetailState(id, state) {
      if (id === 'field-moons') moon2.visible = state === 'Two'
      if (id === 'field-stones') stoneRing[7].visible = state === 'Eight'
      if (id === 'field-torch') {
        torchLit.visible = state === 'It was burning'
        torchCold.visible = state !== 'It was burning'
      }
      if (id === 'field-prints') {
        printsToward.visible = state === 'Toward the chapel'
        printsAway.visible = state !== 'Toward the chapel'
      }
    },
  }
}
