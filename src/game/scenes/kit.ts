import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { PALETTE_HEX } from '../../core/palette'
import { heroAssets } from '../heroAssets'

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
  robe: new THREE.MeshLambertMaterial({ color: 0x413d4a, flatShading: true }),
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

// The iso camera never rotates, so sky discs get a fixed billboard rotation.
export const CAM_DIR = new THREE.Vector3(
  Math.cos(Math.PI / 6) * Math.cos(Math.PI / 4),
  Math.sin(Math.PI / 6),
  Math.cos(Math.PI / 6) * Math.sin(Math.PI / 4)
)

export function moon(r = 0.9, colorHex = PALETTE_HEX.bone): THREE.Mesh {
  const geo = new THREE.CircleGeometry(r, 24)
  const mat = new THREE.MeshBasicMaterial({ color: colorHex, fog: false })
  const m = new THREE.Mesh(geo, mat)
  m.name = 'moon'
  m.lookAt(CAM_DIR)
  return m
}

export function pawn(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.05, 7), MAT.robe)
  body.position.y = 0.55
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), MAT.bone)
  head.position.y = 1.12
  // Blob shadow: fake, cheap, keeps the figure readable at every zoom.
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 12),
    new THREE.MeshBasicMaterial({ color: 0x0d0c10, transparent: true, opacity: 0.55, depthWrite: false })
  )
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.17
  g.add(body, head, shadow)
  g.name = 'pawn'
  return g
}

// The face patch and clasped hands make the facing direction readable
// at 360px; +z is "toward".
export function figureStatue(h = 2.4): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.ConeGeometry(h * 0.24, h * 0.82, 6), MAT.bone)
  body.position.y = h * 0.41
  const head = new THREE.Mesh(new THREE.SphereGeometry(h * 0.11, 8, 6), MAT.bone)
  head.position.y = h * 0.88
  const face = new THREE.Mesh(new THREE.BoxGeometry(h * 0.11, h * 0.09, 0.04), MAT.charcoal)
  face.position.set(0, h * 0.88, h * 0.1)
  const hands = new THREE.Mesh(new THREE.BoxGeometry(h * 0.14, h * 0.1, h * 0.08), MAT.charcoal)
  hands.position.set(0, h * 0.52, h * 0.2)
  g.add(body, head, face, hands)
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

export function mergeParts(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  return mergeGeometries(geos)
}

// Ash falls everywhere the world still stands. Points at ~1px, drifting down.
export function ashFall(
  w: number,
  d: number,
  count = 70,
  opts?: { height?: number; speed?: number }
): { points: THREE.Points; update: (dt: number) => void } {
  const height = opts?.height ?? 12
  const speed = opts?.speed ?? 0.55
  const positions = new Float32Array(count * 3)
  const drift = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * w
    positions[i * 3 + 1] = rand() * height
    positions[i * 3 + 2] = (rand() - 0.5) * d
    drift[i] = (rand() - 0.5) * 0.3
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({
    color: 0x8f8a7d,
    size: 1.6,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  })
  const points = new THREE.Points(geo, mat)
  points.name = 'ash-fall'
  const pos = geo.attributes.position as THREE.BufferAttribute
  return {
    points,
    update(dt: number) {
      for (let i = 0; i < count; i++) {
        let y = pos.getY(i) - speed * dt * (0.6 + (i % 5) * 0.18)
        if (y < 0.1) y = height
        pos.setY(i, y)
        pos.setX(i, pos.getX(i) + drift[i] * dt)
      }
      pos.needsUpdate = true
    },
  }
}

// A dead tree: trunk + a few branches merged into one silhouette mesh.
export function deadTree(h = 3.2): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = []
  const trunk = new THREE.CylinderGeometry(0.06, 0.16, h, 5)
  trunk.translate(0, h / 2, 0)
  parts.push(trunk)
  const branches = 3 + Math.floor(rand() * 3)
  for (let i = 0; i < branches; i++) {
    const bh = h * (0.3 + rand() * 0.35)
    const b = new THREE.CylinderGeometry(0.02, 0.06, bh, 4)
    b.translate(0, bh / 2, 0)
    b.rotateZ(0.5 + rand() * 0.9)
    b.rotateY(rand() * Math.PI * 2)
    b.translate(0, h * (0.45 + rand() * 0.4), 0)
    parts.push(b)
  }
  const m = new THREE.Mesh(mergeGeometries(parts), MAT.charcoal)
  m.rotation.y = rand() * Math.PI
  m.name = 'dead-tree'
  return m
}

// The ruined town on the horizon: flat dark slabs merged into one mesh,
// meant to sit at the fog line and never resolve.
export function ruinSkyline(count: number, arcCenter: THREE.Vector3, radius: number): THREE.Mesh {
  const parts: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const a = Math.PI * 1.15 + (i / (count - 1)) * Math.PI * 0.75
    const w = 1.2 + rand() * 2.4
    const h = 2 + rand() * 5
    const g = new THREE.BoxGeometry(w, h, 0.6)
    g.translate(
      arcCenter.x + Math.cos(a) * radius,
      h / 2 - 0.1,
      arcCenter.z + Math.sin(a) * radius
    )
    parts.push(g)
  }
  const m = new THREE.Mesh(mergeGeometries(parts), MAT.charcoal)
  m.name = 'ruin-skyline'
  return m
}

// Rubble: one instanced mesh of small shards.
export function rubble(count: number, area: [number, number], center: [number, number]): THREE.InstancedMesh {
  const geo = new THREE.TetrahedronGeometry(0.16)
  const mesh = new THREE.InstancedMesh(geo, MAT.stone, count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  for (let i = 0; i < count; i++) {
    e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
    q.setFromEuler(e)
    m.compose(
      new THREE.Vector3(
        center[0] + (rand() - 0.5) * area[0],
        0.06 + rand() * 0.06,
        center[1] + (rand() - 0.5) * area[1]
      ),
      q,
      new THREE.Vector3(0.5 + rand(), 0.4 + rand() * 0.6, 0.5 + rand())
    )
    mesh.setMatrixAt(i, m)
  }
  return mesh
}

// A bank of candles merged into two meshes (sticks + flames).
export function candleBank(count: number, spread = 1.6): THREE.Group {
  const sticks: THREE.BufferGeometry[] = []
  const flames: THREE.BufferGeometry[] = []
  for (let i = 0; i < count; i++) {
    const h = 0.18 + rand() * 0.22
    const x = (rand() - 0.5) * spread
    const z = (rand() - 0.5) * spread * 0.5
    const s = new THREE.CylinderGeometry(0.045, 0.055, h, 5)
    s.translate(x, h / 2, z)
    sticks.push(s)
    const f = new THREE.SphereGeometry(0.045, 5, 4)
    f.translate(x, h + 0.06, z)
    flames.push(f)
  }
  const g = new THREE.Group()
  g.add(new THREE.Mesh(mergeGeometries(sticks), MAT.bone))
  g.add(new THREE.Mesh(mergeGeometries(flames), flameMat))
  const glow = new THREE.PointLight(0xc28f2c, 8, 6, 1.8)
  glow.position.y = 0.5
  g.add(glow)
  g.name = 'candle-bank'
  return g
}

// Cold torches where the crowd dropped them: merged poles + heads.
export function droppedTorches(spots: [number, number, number][]): THREE.Group {
  const poles: THREE.BufferGeometry[] = []
  const heads: THREE.BufferGeometry[] = []
  for (const [x, z, yaw] of spots) {
    const pole = new THREE.CylinderGeometry(0.05, 0.07, 1.5, 5)
    pole.rotateZ(Math.PI / 2 - 0.12)
    pole.rotateY(yaw)
    pole.translate(x, 0.12, z)
    poles.push(pole)
    const head = new THREE.SphereGeometry(0.13, 6, 5)
    head.translate(x + Math.cos(yaw) * 0.75, 0.16, z - Math.sin(yaw) * 0.75)
    heads.push(head)
  }
  const g = new THREE.Group()
  g.add(new THREE.Mesh(mergeGeometries(poles), MAT.darkStone))
  g.add(new THREE.Mesh(mergeGeometries(heads), MAT.charcoal))
  g.name = 'dropped-torches'
  return g
}

// The ARCHIVIST's locus: a classical bust that waits at the mark.
// The pipeline smears reality around it; the render never keeps it still.
// When the §7c avatar generation is present, the primitive head yields to a
// 1-bit face quad billboarded at the iso camera — sitting inside the locus
// smear, so the render owns its dissolving.
export function archivistBust(): THREE.Group {
  const g = new THREE.Group()
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.7), MAT.darkStone)
  plinth.position.y = 0.5
  const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.22, 0.3), MAT.bone)
  shoulders.position.y = 1.12
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.14, 6), MAT.bone)
  neck.position.y = 1.28
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 9, 7), MAT.bone)
  head.position.y = 1.46
  head.scale.set(0.88, 1.05, 0.92)
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.1), MAT.stone)
  brow.position.set(0, 1.5, 0.13)
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.07), MAT.bone)
  nose.position.set(0, 1.44, 0.17)
  g.add(plinth, shoulders, neck, head, brow, nose)
  g.name = 'archivist'
  heroAssets.whenReady('avatar', () => {
    const tex = heroAssets.worldTexture('avatar')
    const a = heroAssets.get('avatar')
    if (!tex || !a) return
    g.remove(neck, head, brow, nose)
    const hgt = 0.78
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(hgt * (a.w / a.h), hgt),
      new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 })
    )
    quad.position.y = 1.52
    quad.lookAt(quad.position.clone().add(CAM_DIR))
    quad.name = 'archivist-avatar'
    g.add(quad)
  })
  return g
}

// Linear fog calibrated to the iso camera distance: the whole scene sits in a
// narrow depth band, so near/far are offsets from camDistance, not absolutes.
export function pew(w = 1.8): THREE.Group {
  const g = new THREE.Group()
  const seat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, 0.45), MAT.darkStone)
  seat.position.y = 0.42
  const back = new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 0.09), MAT.darkStone)
  back.position.set(0, 0.62, -0.2)
  const legs = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.42, 0.08), MAT.charcoal)
  legs.position.y = 0.21
  g.add(seat, back, legs)
  return g
}

export function altar(): THREE.Group {
  const g = new THREE.Group()
  const slab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.18, 0.9), MAT.stone)
  slab.position.y = 0.95
  const base = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 0.7), MAT.darkStone)
  base.position.y = 0.45
  g.add(slab, base)
  return g
}

// A row of candles; show the first `lit` of `total`.
export function candleRow(total = 5): { group: THREE.Group; setCount: (n: number) => void } {
  const group = new THREE.Group()
  const candles: THREE.Group[] = []
  for (let i = 0; i < total; i++) {
    const c = candle(true, 0.22 + (i % 3) * 0.05)
    c.position.x = (i - (total - 1) / 2) * 0.32
    group.add(c)
    candles.push(c)
  }
  return {
    group,
    setCount(n: number) {
      candles.forEach((c, i) => (c.visible = i < n))
    },
  }
}

export function ribbon(gold: boolean): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.7),
    gold ? MAT.gold : MAT.bone
  )
  m.name = 'ribbon'
  return m
}

// Chalk mark: a circle, crossed. Unlit so it stays chalk-bone, never gilds.
const chalkMat = new THREE.MeshBasicMaterial({ color: PALETTE_HEX.bone })
export function chalkMark(): THREE.Group {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 16), chalkMat)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.05, 0.03), chalkMat)
  bar.rotation.z = Math.PI / 4
  g.add(ring, bar)
  return g
}

export type GlyphKind = 'circle' | 'cross' | 'wave' | 'eye'

// Glyphs are sculptures on plinths — readable silhouettes at 360px.
// Sized up 1.5x (July 4, Maxim's call): keeping them sculptural beat
// generating a drawn glyph set; legibility comes from scale instead.
const GLYPH_SCALE = 1.5
export function glyphStone(kind: GlyphKind): THREE.Group {
  const g = new THREE.Group()
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.6), MAT.darkStone)
  plinth.position.y = 0.42
  g.add(plinth)
  let top: THREE.Mesh
  if (kind === 'circle') {
    top = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.06, 6, 14), MAT.bone)
  } else if (kind === 'cross') {
    top = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), MAT.bone)
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.1), MAT.bone)
    arm.position.y = 0.1
    top.add(arm)
  } else if (kind === 'wave') {
    top = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.055, 6, 8, Math.PI), MAT.bone)
    const half = new THREE.Mesh(
      new THREE.TorusGeometry(0.1, 0.055, 6, 8, Math.PI),
      MAT.bone
    )
    half.position.x = 0.3
    half.rotation.z = Math.PI
    top.add(half)
  } else {
    top = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), MAT.bone)
    top.scale.z = 0.45
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), MAT.charcoal)
    pupil.position.z = 0.16
    top.add(pupil)
  }
  top.scale.setScalar(GLYPH_SCALE)
  // Mounted higher so the scaled sculpture clears the plinth top.
  top.position.y = 1.35
  g.add(top)
  g.name = `glyph-${kind}`
  return g
}

export function towerBody(): THREE.Group {
  const g = new THREE.Group()
  const body = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.0, 8, 9), MAT.stone)
  body.position.y = 4
  g.add(body)
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.5, 0.9, 9), MAT.darkStone)
  cap.position.y = 8.4
  g.add(cap)
  return g
}

export function beaconFlame(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), flameMat)
  m.name = 'beacon'
  return m
}

// The god-beam: additive cone, the one bright thing.
export function godBeam(height = 18, r = 3.2): THREE.Mesh {
  const geo = new THREE.ConeGeometry(r, height, 12, 1, true)
  const mat = new THREE.MeshBasicMaterial({
    color: 0xe8dfc9,
    transparent: true,
    opacity: 0.16,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  })
  const m = new THREE.Mesh(geo, mat)
  m.position.y = height / 2
  m.name = 'god-beam'
  return m
}

// Ceiling of bodies: silhouette-first instanced masses. Never let them resolve.
export function ceilingMasses(count: number, area: [number, number], y: number): THREE.InstancedMesh {
  const geo = new THREE.IcosahedronGeometry(1.1, 0)
  const mesh = new THREE.InstancedMesh(geo, MAT.charcoal, count)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const e = new THREE.Euler()
  for (let i = 0; i < count; i++) {
    e.set(rand() * Math.PI, rand() * Math.PI, rand() * Math.PI)
    q.setFromEuler(e)
    m.compose(
      new THREE.Vector3(
        (rand() - 0.5) * area[0],
        y + (rand() - 0.5) * 1.6,
        (rand() - 0.5) * area[1]
      ),
      q,
      new THREE.Vector3(0.7 + rand() * 1.3, 0.5 + rand() * 0.9, 0.7 + rand() * 1.2)
    )
    mesh.setMatrixAt(i, m)
  }
  return mesh
}

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
