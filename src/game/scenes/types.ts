import * as THREE from 'three'
import { Grid, type Cell } from '../grid'
import type { DetailSpec } from '../ledger'

// An anchor ties a ledger detail to a place in the world for
// plausibly-seen logging and examine interactions.
export interface Anchor {
  object: THREE.Object3D
  radius: number // player must be this close for dwell to count
  sky?: boolean // visible from anywhere on screen (moons)
  examinable?: boolean
}

export interface PlainExamine {
  id: string
  object: THREE.Object3D
  caption: string
}

export interface GameScene {
  id: string
  three: THREE.Scene
  grid: Grid
  spawnCell: Cell
  viewWidth: number
  details: DetailSpec[]
  anchors: Map<string, Anchor>
  plainExamines: PlainExamine[]
  waymark: THREE.Vector3 // where the machine waits; tap to end the walk
  entryLine: string
  quiz: { lie: boolean; mutation: boolean; quizCount?: number }
  weather?: number // ambient floor for the render pipeline, rises scene to scene
  applyDetailState(id: string, state: string): void
  update?(dt: number, t: number): void
  // Scene-specific hook run when the player re-enters after the quiz.
  onReentry?(): void
}
