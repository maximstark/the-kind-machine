import * as THREE from 'three'
import { Grid, type Cell } from './grid'
import { Character } from './character'
import { bus } from '../core/bus'

const SPEED = 3.4 // cells per second

export class Player {
  readonly character: Character
  readonly object: THREE.Group
  cell: Cell
  private grid: Grid
  private route: Cell[] = []
  private progress = 0
  private fromPos = new THREE.Vector3()
  private toPos = new THREE.Vector3()
  private moveDir = new THREE.Vector3()
  onArrive: (() => void) | null = null

  constructor(grid: Grid, spawn: Cell) {
    this.grid = grid
    this.cell = spawn
    this.character = new Character()
    this.object = this.character.root
    this.object.position.copy(grid.cellToWorld(spawn))
  }

  get puffs() {
    return this.character.puffs
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

  update(dt: number, t: number) {
    let speed = 0
    if (this.route.length) {
      speed = SPEED * this.grid.cell
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
          speed = 0
          break
        }
      }
      if (this.route.length) {
        const y = this.object.position.y
        this.object.position.lerpVectors(this.fromPos, this.toPos, this.progress)
        this.object.position.y = y // the character owns its own bob
        this.moveDir.subVectors(this.toPos, this.fromPos).normalize()
      }
    }
    this.character.update(dt, t, speed, this.route.length ? this.moveDir : null)
  }
}
