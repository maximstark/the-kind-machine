import * as THREE from 'three'

// Walkable grid over the ground plane. BFS pathfinding, 4-directional.
// Cells are 1 world unit; origin centers the grid on (0,0).

export interface Cell {
  cx: number
  cz: number
}

export class Grid {
  private blocked = new Set<number>()

  constructor(
    public readonly w: number,
    public readonly h: number,
    public readonly cell = 1
  ) {}

  private key(cx: number, cz: number) {
    return (cz + 512) * 2048 + (cx + 512)
  }

  inBounds(cx: number, cz: number) {
    return cx >= -this.w / 2 && cx < this.w / 2 && cz >= -this.h / 2 && cz < this.h / 2
  }

  block(cx: number, cz: number) {
    this.blocked.add(this.key(cx, cz))
  }

  blockCircle(x: number, z: number, r: number) {
    const c = this.worldToCell(new THREE.Vector3(x, 0, z))
    const cr = Math.ceil(r / this.cell)
    for (let dx = -cr; dx <= cr; dx++) {
      for (let dz = -cr; dz <= cr; dz++) {
        const wx = (c.cx + dx + 0.5) * this.cell
        const wz = (c.cz + dz + 0.5) * this.cell
        if ((wx - x) ** 2 + (wz - z) ** 2 <= r * r) this.block(c.cx + dx, c.cz + dz)
      }
    }
  }

  isWalkable(cx: number, cz: number) {
    return this.inBounds(cx, cz) && !this.blocked.has(this.key(cx, cz))
  }

  worldToCell(v: THREE.Vector3): Cell {
    return { cx: Math.floor(v.x / this.cell), cz: Math.floor(v.z / this.cell) }
  }

  cellToWorld(c: Cell): THREE.Vector3 {
    return new THREE.Vector3((c.cx + 0.5) * this.cell, 0, (c.cz + 0.5) * this.cell)
  }

  // BFS shortest path. If target is blocked, walks to the nearest
  // walkable cell adjacent to it (tap-on-prop still approaches it).
  path(from: Cell, to: Cell): Cell[] {
    if (!this.inBounds(to.cx, to.cz)) return []
    const goal = this.isWalkable(to.cx, to.cz) ? to : this.nearestWalkable(to)
    if (!goal) return []
    if (from.cx === goal.cx && from.cz === goal.cz) return []

    const seen = new Map<number, number>() // key -> parent key
    const startKey = this.key(from.cx, from.cz)
    seen.set(startKey, -1)
    let frontier: Cell[] = [from]
    const goalKey = this.key(goal.cx, goal.cz)

    while (frontier.length) {
      const next: Cell[] = []
      for (const c of frontier) {
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = c.cx + dx
          const nz = c.cz + dz
          const k = this.key(nx, nz)
          if (seen.has(k) || !this.isWalkable(nx, nz)) continue
          seen.set(k, this.key(c.cx, c.cz))
          if (k === goalKey) {
            const out: Cell[] = [{ cx: nx, cz: nz }]
            let cur = this.key(c.cx, c.cz)
            while (cur !== startKey && cur !== -1) {
              out.unshift({ cx: (cur % 2048) - 512, cz: Math.floor(cur / 2048) - 512 })
              cur = seen.get(cur)!
            }
            return out
          }
          next.push({ cx: nx, cz: nz })
        }
      }
      frontier = next
    }
    return []
  }

  nearestWalkable(c: Cell): Cell | null {
    for (let r = 1; r <= 6; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue
          if (this.isWalkable(c.cx + dx, c.cz + dz)) return { cx: c.cx + dx, cz: c.cz + dz }
        }
      }
    }
    return null
  }
}
