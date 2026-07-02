import * as THREE from 'three'
import { MAT } from './scenes/kit'
import { bus } from '../core/bus'

// The wanderer. Primitives articulated into a hooded figure; all motion
// is procedural — springs, phase, and lag. At 360px what reads is
// silhouette and weight, so that is what this spends its budget on.

function damp(current: number, target: number, lambda: number, dt: number) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt))
}

function shortestAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

interface Puff {
  mesh: THREE.Mesh
  life: number
}

export class Character {
  readonly root: THREE.Group
  readonly puffs: THREE.Group

  private body: THREE.Group
  private torso: THREE.Mesh
  private headGroup: THREE.Group
  private sleeveL: THREE.Mesh
  private sleeveR: THREE.Mesh
  private hem: THREE.Mesh[] = []

  private facing = 0
  private targetFacing = 0
  private walkPhase = 0
  private speedNorm = 0 // smoothed 0..1
  private headYaw = 0
  private headBob = 0
  private lean = 0
  private attention: THREE.Vector3 | null = null
  private puffPool: Puff[] = []

  constructor() {
    this.root = new THREE.Group()
    this.root.name = 'wanderer'

    // Blob shadow (world-locked orientation, fake and cheap).
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 12),
      new THREE.MeshBasicMaterial({ color: 0x0d0c10, transparent: true, opacity: 0.55, depthWrite: false })
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.16
    this.root.add(shadow)

    this.body = new THREE.Group()
    this.body.position.y = 0.5
    this.root.add(this.body)

    // Torso: tapered robe upper.
    const torsoGeo = new THREE.CylinderGeometry(0.15, 0.3, 0.72, 7)
    torsoGeo.translate(0, 0.36, 0)
    this.torso = new THREE.Mesh(torsoGeo, MAT.robe)
    this.body.add(this.torso)

    // Head under a hood, a sliver of bone showing.
    this.headGroup = new THREE.Group()
    this.headGroup.position.y = 0.78
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 7), MAT.robe)
    hood.position.y = 0.1
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 8, 6), MAT.robe)
    skull.position.y = 0.02
    const face = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), MAT.bone)
    face.position.set(0, 0.0, 0.07)
    face.scale.set(0.85, 0.95, 0.6)
    // Hood brim: a light line that articulates every head move.
    const brim = new THREE.Mesh(new THREE.TorusGeometry(0.125, 0.018, 5, 10), MAT.stone)
    brim.rotation.x = Math.PI / 2 - 0.35
    brim.position.set(0, 0.04, 0.02)
    this.headGroup.add(hood, skull, face, brim)
    this.body.add(this.headGroup)

    // Sleeves, hinged at the shoulders.
    const sleeveGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.36, 6)
    sleeveGeo.translate(0, -0.18, 0)
    this.sleeveL = new THREE.Mesh(sleeveGeo, MAT.robe)
    this.sleeveL.position.set(-0.18, 0.62, 0)
    this.sleeveR = new THREE.Mesh(sleeveGeo.clone(), MAT.robe)
    this.sleeveR.position.set(0.18, 0.62, 0)
    this.body.add(this.sleeveL, this.sleeveR)

    // Robe hem: three rings, each hinged at its top, lagging the body.
    const ringSpecs: [number, number, number, number][] = [
      // topR, botR, height, hingeY
      [0.19, 0.27, 0.26, 0.52],
      [0.26, 0.34, 0.26, 0.3],
      [0.33, 0.42, 0.3, 0.1],
    ]
    ringSpecs.forEach(([rt, rb, h, y], i) => {
      const geo = new THREE.CylinderGeometry(rt, rb, h, 7, 1, true)
      geo.translate(0, -h / 2, 0)
      const ring = new THREE.Mesh(geo, MAT.robe)
      ring.position.y = y
      // Trim on the lowest ring: the sway line the eye follows.
      if (i === ringSpecs.length - 1) {
        const trim = new THREE.Mesh(new THREE.TorusGeometry(rb - 0.015, 0.02, 5, 12), MAT.stone)
        trim.rotation.x = Math.PI / 2
        trim.position.y = -h + 0.02
        ring.add(trim)
      }
      this.root.add(ring)
      this.hem.push(ring)
    })

    // Cuffs.
    for (const s of [this.sleeveL, this.sleeveR]) {
      const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.015, 5, 8), MAT.stone)
      cuff.rotation.x = Math.PI / 2
      cuff.position.y = -0.34
      s.add(cuff)
    }

    // Ash puffs live in world space, not on the figure.
    this.puffs = new THREE.Group()
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(0.14, 8),
        new THREE.MeshBasicMaterial({ color: 0x6a675e, transparent: true, opacity: 0, depthWrite: false })
      )
      m.rotation.x = -Math.PI / 2
      m.visible = false
      this.puffs.add(m)
      this.puffPool.push({ mesh: m, life: 0 })
    }
  }

  lookToward(target: THREE.Vector3 | null) {
    this.attention = target
  }

  setFacing(yaw: number) {
    this.targetFacing = yaw
  }

  private step() {
    bus.emit('char:step')
    const p = this.puffPool.find((x) => x.life <= 0)
    if (!p) return
    p.life = 0.55
    p.mesh.visible = true
    p.mesh.position.set(
      this.root.position.x + (Math.random() - 0.5) * 0.2,
      0.18,
      this.root.position.z + (Math.random() - 0.5) * 0.2
    )
  }

  // speed: world units/sec; moveDir: normalized xz heading (or null when still)
  update(dt: number, t: number, speed: number, moveDir: THREE.Vector3 | null) {
    const targetNorm = Math.min(1, speed / 3.4)
    this.speedNorm = damp(this.speedNorm, targetNorm, 8, dt)
    const s = this.speedNorm

    if (moveDir && speed > 0.01) {
      this.targetFacing = Math.atan2(moveDir.x, moveDir.z)
    } else if (this.attention) {
      const to = this.attention.clone().sub(this.root.position)
      if (to.lengthSq() > 0.5) this.targetFacing = Math.atan2(to.x, to.z)
    }
    const dYaw = shortestAngle(this.targetFacing - this.facing)
    this.facing += dYaw * (1 - Math.exp(-9 * dt))
    this.root.rotation.y = this.facing

    // Stride: one footfall each half-cycle.
    const prevPhase = this.walkPhase
    this.walkPhase += speed * dt * (Math.PI / 0.52)
    if (s > 0.25 && Math.floor(this.walkPhase / Math.PI) > Math.floor(prevPhase / Math.PI)) {
      this.step()
    }

    const bob = Math.abs(Math.sin(this.walkPhase)) * 0.055 * s
    this.root.position.y = bob

    // Weight: lean into motion, roll with the stride, breathe at rest.
    this.lean = damp(this.lean, 0.16 * s + Math.abs(dYaw) * 0.06, 6, dt)
    this.body.rotation.x = this.lean
    this.body.rotation.z = Math.sin(this.walkPhase) * 0.055 * s
    const breath = (1 - s) * Math.sin(t * 1.7) * 0.013
    this.torso.scale.set(1, 1 + breath, 1)

    // Head: counter-bob with lag, glances at what matters.
    this.headBob = damp(this.headBob, -bob * 0.5, 12, dt)
    this.headGroup.position.y = 0.78 + this.headBob
    let wantYaw = 0
    if (this.attention) {
      const to = this.attention.clone().sub(this.root.position)
      wantYaw = THREE.MathUtils.clamp(
        shortestAngle(Math.atan2(to.x, to.z) - this.facing),
        -0.7,
        0.7
      )
    }
    this.headYaw = damp(this.headYaw, wantYaw, 4, dt)
    this.headGroup.rotation.y = this.headYaw
    this.headGroup.rotation.x = 0.08 * s - 0.04 * (1 - s) * Math.sin(t * 0.9)

    // Sleeves swing opposite each other; settle to a hang at rest.
    const swing = 0.38 * s
    this.sleeveL.rotation.x = Math.sin(this.walkPhase) * swing - this.lean * 0.8
    this.sleeveR.rotation.x = Math.sin(this.walkPhase + Math.PI) * swing - this.lean * 0.8
    this.sleeveL.rotation.z = 0.08 + Math.sin(t * 1.3) * 0.015 * (1 - s)
    this.sleeveR.rotation.z = -0.08 - Math.sin(t * 1.3 + 1) * 0.015 * (1 - s)

    // Hem rings lag the body: sway back against motion, kick with strides.
    this.hem.forEach((ring, i) => {
      const lagLambda = 7 - i * 1.6
      const kick = Math.sin(this.walkPhase * 2 + i * 0.9) * 0.05 * s
      const targetX = -this.lean * (1.1 + i * 0.5) + kick
      const targetZ = -Math.sin(this.walkPhase) * 0.05 * s * (1 + i * 0.5)
      ring.rotation.x = damp(ring.rotation.x, targetX, lagLambda, dt)
      ring.rotation.z = damp(ring.rotation.z, targetZ, lagLambda, dt)
    })

    // Puffs rise, spread, fade.
    for (const p of this.puffPool) {
      if (p.life <= 0) continue
      p.life -= dt
      const k = 1 - Math.max(0, p.life) / 0.55
      const mat = p.mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.4 * (1 - k)
      p.mesh.scale.setScalar(0.5 + k * 1.6)
      if (p.life <= 0) p.mesh.visible = false
    }
  }
}
