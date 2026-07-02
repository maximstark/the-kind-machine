import * as THREE from 'three'
import { PALETTE_HEX } from '../../core/palette'

// Modular graybox prop kit. Flat-shaded low-poly primitives; the dither
// shader does the art. All placeholder dressing — TODO(maxim): hero assets per §7c.

// Albedos are chosen so LIT values land near intended palette entries:
// ground/stone -> ash, highlights -> bone, robes -> black, accents -> gold.
export const MAT = {
  ground: new THREE.MeshLambertMaterial({ color: 0x4e5055, vertexColors: true }),
  stone: new THREE.MeshLambertMaterial({ color: 0x7d7e84, flatShading: true }),
  darkStone: new THREE.MeshLambertMaterial({ color: 0x3a362f, flatShading: true }),
  bone: new THREE.MeshLambertMaterial({ color: 0xcfc6ae, flatShading: true }),
  gold: new THREE.MeshLambertMaterial({
    color: 0x8a6a20,
    emissive: 0x6b4e12,
    emissiveIntensity: 0.55,
    flatShading: true,
  }),
  charcoal: new THREE.MeshLambertMaterial({ color: 0x211e24, flatShading: true }),
  robe: new THREE.MeshLambertMaterial({ color: 0x2c2830, flatShading: true }),
}

let _seed = 7
function rand() {
  _seed = (_seed * 16807) % 2147483647
  return (_seed - 1) / 2147483646
}
export function reseed(n: number) {
  _seed = n
}

function patchNoise(x: number, y: number): number {
  const s = Math.sin(x * 0.31 + y * 0.47) + Math.sin(x * 0.13 - y * 0.19 + 2.1)
  const f = Math.sin(x * 0.9 + y * 1.3 + 5.0) * 0.4
  return (s + f) / 2.4
}

export function ground(w: number, d: number, jitter = 0.14): THREE.Mesh {
  const segs = Math.max(8, Math.floor(Math.max(w, d) / 1.2))
  const geo = new THREE.PlaneGeometry(w, d, segs, segs)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    pos.setZ(i, (rand() - 0.5) * 2 * jitter)
    const v = 1 + patchNoise(pos.getX(i), pos.getY(i)) * 0.28
    colors[i * 3] = v
    colors[i * 3 + 1] = v
    colors[i * 3 + 2] = v
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, MAT.ground)
  m.rotation.x = -Math.PI / 2
  m.name = 'ground'
  return m
}

export function standingStone(h = 1.6, w = 0.55): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, w * 0.7)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) {
      pos.setX(i, pos.getX(i) * (0.55 + rand() * 0.3))
      pos.setZ(i, pos.getZ(i) * (0.6 + rand() * 0.3))
    }
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, MAT.stone)
  m.position.y = h / 2 - 0.05
  m.rotation.y = rand() * Math.PI
  m.rotation.z = (rand() - 0.5) * 0.12
  return m
}

export function column(h = 5, r = 0.45): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r * 0.85, r, h, 7)
  const m = new THREE.Mesh(geo, MAT.stone)
  m.position.y = h / 2
  return m
}

export function brokenColumn(h = 2.2, r = 0.45): THREE.Mesh {
  const geo = new THREE.CylinderGeometry(r * 0.92, r, h, 7)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > h * 0.4) pos.setY(i, pos.getY(i) - rand() * 0.5)
  }
  geo.computeVertexNormals()
  const m = new THREE.Mesh(geo, MAT.stone)
  m.position.y = h / 2
  return m
}

export function moon(r = 0.9, colorHex = PALETTE_HEX.bone): THREE.Mesh {
  const geo = new THREE.CircleGeometry(r, 24)
  const mat = new THREE.MeshBasicMaterial({ color: colorHex, fog: false })
  const m = new THREE.Mesh(geo, mat)
  m.name = 'moon'
  return m
}

export function pawn(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.05, 7), MAT.robe)
  body.position.y = 0.55
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), MAT.bone)
  head.position.y = 1.12
  g.add(body, head)
  g.name = 'pawn'
  return g
}

export function figureStatue(h = 2.4): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(h * 0.24, h * 0.82, 6), MAT.bone)
  body.position.y = h * 0.41
  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.11, 8, 6), MAT.bone)
  head.position.y = h * 0.88
  g.add(body, head)
  return g
}

export function ashSilhouette(): THREE.Mesh {
  const shape = new THREE.Shape()
  shape.moveTo(-0.35, 0)
  shape.lineTo(-0.28, 0.9)
  shape.lineTo(-0.12, 1.15)
  shape.lineTo(0.05, 1.45)
  shape.lineTo(0.2, 1.1)
  shape.lineTo(0.3, 0.85)
  shape.lineTo(0.38, 0)
  shape.closePath()
  const geo = new THREE.ShapeGeometry(shape)
  const m = new THREE.Mesh(geo, MAT.charcoal)
  m.name = 'ash-silhouette'
  return m
}

export function footprints(
  from: THREE.Vector3,
  to: THREE.Vector3,
  count = 12
): THREE.Group {
  const g = new THREE.Group()
  const geo = new THREE.PlaneGeometry(0.16, 0.3)
  const mat = new THREE.MeshBasicMaterial({ color: 0x26232a })
  const dir = to.clone().sub(from)
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const p = from.clone().addScaledVector(dir, t)
    const side = i % 2 === 0 ? 0.14 : -0.14
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).normalize()
    const m = new THREE.Mesh(geo, mat)
    m.rotation.x = -Math.PI / 2
    m.rotation.z = Math.atan2(dir.x, dir.z) + (rand() - 0.5) * 0.2
    m.position.copy(p).addScaledVector(perp, side)
    m.position.y = 0.16
    g.add(m)
  }
  g.name = 'footprints'
  return g
}

const flameMat = new THREE.MeshBasicMaterial({ color: 0xd9a33c })

export function torch(lit = false): THREE.Group {
  const g = new THREE.Group()
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5), MAT.darkStone)
  pole.position.y = 0.75
  g.add(pole)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 5), lit ? flameMat : MAT.charcoal)
  head.position.y = 1.55
  g.add(head)
  if (lit) {
    const glow = new THREE.PointLight(0xc28f2c, 14, 7, 1.6)
    glow.position.y = 1.6
    g.add(glow)
  }
  g.name = lit ? 'torch-lit' : 'torch'
  return g
}

export function candle(lit = true, h = 0.28): THREE.Group {
  const g = new THREE.Group()
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 6), MAT.bone)
  stick.position.y = h / 2
  g.add(stick)
  if (lit) {
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), MAT.gold)
    flame.position.y = h + 0.07
    g.add(flame)
  }
  g.name = lit ? 'candle-lit' : 'candle-unlit'
  return g
}

export function door(w = 1.6, h = 2.6): THREE.Group {
  const g = new THREE.Group()
  const slab = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.2), MAT.darkStone)
  slab.position.y = h / 2
  g.add(slab)
  return g
}

export function wall(w: number, h: number, thick = 0.4): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, thick), MAT.darkStone)
  m.position.y = h / 2
  return m
}

// Linear fog calibrated to the iso camera distance: the whole scene sits in a
// narrow depth band, so near/far are offsets from camDistance, not absolutes.
export function lightRig(
  scene: THREE.Scene,
  opts?: { dirIntensity?: number; camDistance?: number; fogNear?: number; fogFar?: number }
) {
  const dir = new THREE.DirectionalLight(0xf2efe6, opts?.dirIntensity ?? 3.2)
  dir.position.set(-14, 22, 8)
  scene.add(dir)
  const hemi = new THREE.HemisphereLight(0x8f8c9c, 0x1a1720, 0.9)
  scene.add(hemi)
  const d = opts?.camDistance ?? 30
  scene.fog = new THREE.Fog(0x131118, d + (opts?.fogNear ?? -2), d + (opts?.fogFar ?? 22))
  scene.background = new THREE.Color(0x131118)
  return { dir, hemi }
}
