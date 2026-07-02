import * as THREE from 'three'
import { Grid, type Cell } from './grid'
import { pawn } from './scenes/kit'
import { bus } from '../core/bus'

const SPEED = 3.4 // cells per second

export class Player {
  readonly object: THREE.Group
  cell: Cell
  private grid: Grid
  private route: Cell[] = []
  private progress = 0
  private fromPos = new THREE.Vector3()
  private toPos = new THREE.Vector3()
  onArrive: (() => void) | null = null

  constructor(grid: Grid, spawn: Cell) {
    this.grid = grid
    this.cell = spawn
    this.object = pawn()
    this.object.position.copy(grid.cellToWorld(spawn))
  }

  setGrid(grid: Grid, spawn: Cell) {
    this.grid = grid
    this.cell = spawn
    this.route = []
    this.object.position.copy(grid.cellToWorld(spawn))
  }

  get moving() {
    return this.route.length > 0
  }

  walkTo(target: Cell) {
    const p = this.grid.path(this.cell, target)
    if (!p.length) {
      this.onArrive?.()
      this.onArrive = null
      return
    }
    this.route = p
    this.progress = 0
    this.fromPos.copy(this.grid.cellToWorld(this.cell))
    this.toPos.copy(this.grid.cellToWorld(p[0]))
  }

  stop() {
    this.route = []
    this.onArrive = null
  }

  update(dt: number) {
    if (!this.route.length) return
    this.progress += dt * SPEED
    while (this.progress >= 1 && this.route.length) {
      this.progress -= 1
      this.cell = this.route.shift()!
      bus.emit('player:stepped', this.cell)
      if (this.route.length) {
        this.fromPos.copy(this.grid.cellToWorld(this.cell))
        this.toPos.copy(this.grid.cellToWorld(this.route[0]))
      } else {
        this.object.position.copy(this.grid.cellToWorld(this.cell))
        const cb = this.onArrive
        this.onArrive = null
        cb?.()
        return
      }
    }
    if (this.route.length) {
      this.object.position.lerpVectors(this.fromPos, this.toPos, this.progress)
      this.object.position.y = Math.abs(Math.sin(this.progress * Math.PI * 2)) * 0.06
    }
  }
}
