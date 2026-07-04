import * as THREE from 'three'
import { Character } from '../game/character'
import { PALETTE_HEX, CSS } from '../core/palette'

// Wanderer sprite-sheet renderer — dev tool, never shipped. Served at
// /sheet.html in dev only; the production build's sole entry is index.html.
//
// Output: a labeled contact sheet for Maxim's imagegen/post-edit passes.
//   rows 1–3: turnaround at the game camera's elevation (idle, stride A,
//             stride B) × 8 yaws — yaw 0° faces the camera
//   row 4:    orthographic references, hood close-up, glance poses, and an
//             in-game-scale dithered pair (the ground truth of how the
//             figure actually reads at 360px under Bayer + palette)
//
// The clean tiles use the game's exact materials and light rig, minus fog.
// The dithered tiles replicate the composite shader's quantize step in JS,
// including its behavior of comparing display-space color against the
// palette as three.js stores it — faithful to the shipped look, quirks and all.

const TILE = 512
const COLS = 8
const GAP = 16
const MARGIN = 32
const LABEL_H = 28
const HEADER = 176
const SUPER = 1024 // clean tiles render 2x and downscale

// In-game pixel density: RT is 360px wide, field frames viewWidth = 11 wu.
const GAME_PX_PER_WU = 360 / 11
const MINI = 72 // 72px at game density = 2.2 wu — same framing as clean tiles
const MINI_SCALE = 7

const CAM_AZ = Math.PI / 4
const CAM_EL = THREE.MathUtils.degToRad(30)
const FRUST_H = 2.0
const CENTER_Y = 0.8

// --- scene: the game's light rig (kit.lightRig values), no fog ---

const scene = new THREE.Scene()
scene.background = new THREE.Color(0x131118)
const dirLight = new THREE.DirectionalLight(0xf2efe6, 3.2)
dirLight.position.set(-14, 22, 8)
const hemi = new THREE.HemisphereLight(0x8f8c9c, 0x1a1720, 0.9)
scene.add(dirLight, hemi)

// Reference fill for the clean tiles only: under the game rig the figure is
// a near-silhouette (by design), which defeats the sheet's purpose as an
// editing base. Row 4's dithered pair keeps the true in-game values.
const fillDir = new THREE.DirectionalLight(0xf2efe6, 1.8)
fillDir.position.set(Math.cos(CAM_AZ) * 10, 9, Math.sin(CAM_AZ) * 10)
const fillHemi = new THREE.HemisphereLight(0x8f8c9c, 0x2a2733, 1.5)

// The minis sit on lit ground, as the figure does in-game — a flat-black
// backdrop over-speckles under the dither and reads nothing like the field.
// Color calibrated against shots/p2-field-dressed.png: the kit ground albedo
// darkened for the fog + weather the field scene adds and this rig lacks.
const miniGround = new THREE.Mesh(
  new THREE.PlaneGeometry(8, 8),
  new THREE.MeshLambertMaterial({ color: 0x34353a })
)
miniGround.rotation.x = -Math.PI / 2

const cleanRenderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
cleanRenderer.toneMapping = THREE.NoToneMapping
cleanRenderer.outputColorSpace = THREE.SRGBColorSpace

// The game's RT has no MSAA; the mini tiles shouldn't either.
const miniRenderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true })
miniRenderer.toneMapping = THREE.NoToneMapping
miniRenderer.outputColorSpace = THREE.SRGBColorSpace

function makeCam(frustH: number, center: THREE.Vector3, elev: number, az: number) {
  const cam = new THREE.OrthographicCamera(-frustH / 2, frustH / 2, frustH / 2, -frustH / 2, 0.1, 100)
  const d = 12
  cam.position.set(
    center.x + d * Math.cos(elev) * Math.cos(az),
    center.y + d * Math.sin(elev),
    center.z + d * Math.cos(elev) * Math.sin(az)
  )
  cam.lookAt(center)
  cam.updateMatrixWorld()
  return cam
}

// --- pose simulation: drive the real Character through its public API ---

interface PoseOpts {
  yaw: number // world yaw; CAM_AZ faces the camera
  mode: 'idle' | 'walk'
  phaseTarget?: number // walk phase (0..2π) to stop at
  attention?: THREE.Vector3 | null
}

function posed(opts: PoseOpts): Character {
  const char = new Character()
  const dt = 1 / 60
  let t = 0
  if (opts.attention) char.lookToward(opts.attention)
  if (opts.mode === 'idle') {
    char.setFacing(opts.yaw)
    // Fixed frame count: every idle tile lands on the identical breath phase.
    for (let i = 0; i < 180; i++) {
      t += dt
      char.update(dt, t, 0, null)
    }
  } else {
    const dir = new THREE.Vector3(Math.sin(opts.yaw), 0, Math.cos(opts.yaw))
    const speed = 3.4 // full stride: player SPEED * grid cell = 3.4 wu/s
    // walkPhase advances by speed*dt*(π/0.52) per frame — track it externally
    // so the sim can stop on the exact pose without touching private state.
    const step = speed * dt * (Math.PI / 0.52)
    let phase = 0
    for (let i = 0; i < 150; i++) {
      t += dt
      phase += step
      char.update(dt, t, speed, dir)
    }
    const target = opts.phaseTarget ?? Math.PI / 2
    for (let i = 0; i < 40; i++) {
      const frac = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      let diff = Math.abs(frac - target)
      diff = Math.min(diff, Math.PI * 2 - diff)
      if (diff < 0.18) break
      t += dt
      phase += step
      char.update(dt, t, speed, dir)
    }
  }
  return char
}

// --- tile renders ---

function renderClean(char: Character, frustH: number, centerY: number, elevDeg: number): HTMLCanvasElement {
  cleanRenderer.setSize(SUPER, SUPER, false)
  const cam = makeCam(frustH, new THREE.Vector3(0, centerY, 0), THREE.MathUtils.degToRad(elevDeg), CAM_AZ)
  scene.add(char.root, fillDir, fillHemi)
  cleanRenderer.render(scene, cam)
  scene.remove(char.root, fillDir, fillHemi)
  const out = document.createElement('canvas')
  out.width = SUPER
  out.height = SUPER
  out.getContext('2d')!.drawImage(cleanRenderer.domElement, 0, 0)
  return out
}

// The composite shader's Bayer matrix, indexed [x][y].
const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]
const DITHER_SPREAD = 0.34

// World pixels quantize to the first four entries only — green is UI-only.
const PAL_WORLD = [PALETTE_HEX.bone, PALETTE_HEX.ash, PALETTE_HEX.black, PALETTE_HEX.gold].map(
  (hex) => {
    const c = new THREE.Color(hex) // converts to working space, as the pipeline does
    return [c.r, c.g, c.b]
  }
)

function quantize(img: ImageData): ImageData {
  const d = img.data
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4
      const bay = BAYER[x % 4][y % 4] / 16
      const c = [0, 1, 2].map((k) =>
        Math.min(1, Math.max(0, d[i + k] / 255 + (bay - 0.5) * DITHER_SPREAD))
      )
      let best = Infinity
      let pick = PAL_WORLD[0]
      for (const p of PAL_WORLD) {
        const dr = c[0] - p[0]
        const dg = c[1] - p[1]
        const db = c[2] - p[2]
        const rbar = (c[0] + p[0]) * 0.5
        const dist = (2 + rbar) * dr * dr + 4 * dg * dg + (3 - rbar) * db * db
        if (dist < best) {
          best = dist
          pick = p
        }
      }
      d[i] = pick[0] * 255
      d[i + 1] = pick[1] * 255
      d[i + 2] = pick[2] * 255
      d[i + 3] = 255
    }
  }
  return img
}

function renderMini(char: Character): HTMLCanvasElement {
  miniRenderer.setSize(MINI, MINI, false)
  const frustH = MINI / GAME_PX_PER_WU
  const cam = makeCam(frustH, new THREE.Vector3(0, CENTER_Y, 0), CAM_EL, CAM_AZ)
  scene.add(char.root, miniGround)
  miniRenderer.render(scene, cam)
  scene.remove(char.root, miniGround)
  const tmp = document.createElement('canvas')
  tmp.width = MINI
  tmp.height = MINI
  const ctx = tmp.getContext('2d')!
  ctx.drawImage(miniRenderer.domElement, 0, 0)
  ctx.putImageData(quantize(ctx.getImageData(0, 0, MINI, MINI)), 0, 0)
  return tmp
}

// --- sheet composition ---

const W = MARGIN * 2 + COLS * TILE + (COLS - 1) * GAP
const H = HEADER + 4 * (TILE + LABEL_H + GAP) + MARGIN
const sheet = document.createElement('canvas')
sheet.width = W
sheet.height = H
const g = sheet.getContext('2d')!

function tileXY(col: number, row: number) {
  return {
    x: MARGIN + col * (TILE + GAP),
    y: HEADER + row * (TILE + LABEL_H + GAP),
  }
}

function drawTile(canvas: HTMLCanvasElement, col: number, row: number, label: string, pixelated = false) {
  const { x, y } = tileXY(col, row)
  g.imageSmoothingEnabled = !pixelated
  if (pixelated) {
    const size = canvas.width * MINI_SCALE
    const off = Math.round((TILE - size) / 2)
    g.fillStyle = '#131118'
    g.fillRect(x, y, TILE, TILE)
    g.drawImage(canvas, x + off, y + off, size, size)
  } else {
    g.drawImage(canvas, x, y, TILE, TILE)
  }
  g.imageSmoothingEnabled = true
  g.strokeStyle = 'rgba(126,123,114,0.35)'
  g.lineWidth = 1
  g.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1)
  g.fillStyle = CSS.ash
  g.font = '15px Consolas, monospace'
  g.textAlign = 'center'
  g.fillText(label, x + TILE / 2, y + TILE + 19)
}

function drawHeader() {
  g.fillStyle = '#131118'
  g.fillRect(0, 0, W, H)
  g.fillStyle = CSS.bone
  g.font = 'bold 28px Georgia, serif'
  g.textAlign = 'left'
  g.fillText('THE KIND MACHINE — the wanderer, reference sheet', MARGIN, 44)
  g.font = '15px Consolas, monospace'
  g.fillStyle = CSS.ash
  const notes = [
    'figure ≈ 1.7 world units ≈ 56 px tall in-game (RT 360px wide, field zoom) · camera: orthographic, azimuth 45°, elevation 30° · yaw 0° faces the camera',
    'materials: robe 0x413d4a · bone 0xcfc6ae · trim 0x7d7e84 — rows 1–3 add fill light for legibility (in-game the figure is a near-silhouette); row 4 right shows the true in-game read after Bayer dither + 5-color quantize',
  ]
  notes.forEach((n, i) => g.fillText(n, MARGIN, 74 + i * 22))
  // Palette chips. Green is included for completeness but is UI-only —
  // it never appears in the world and must never appear on the figure.
  const chips: [string, string, string][] = [
    ['bone', CSS.bone, '#e8dfc9'],
    ['ash', CSS.ash, '#7e7b72'],
    ['black', CSS.black, '#131118'],
    ['gold', CSS.gold, '#a8842e'],
    ['green (UI only — never on the figure)', CSS.green, '#79d49a'],
  ]
  let cx = MARGIN
  for (const [name, css, hex] of chips) {
    g.fillStyle = css
    g.fillRect(cx, 122, 34, 24)
    g.strokeStyle = 'rgba(232,223,201,0.4)'
    g.strokeRect(cx + 0.5, 122.5, 33, 23)
    g.fillStyle = CSS.ash
    g.textAlign = 'left'
    const label = `${name} ${hex}`
    g.fillText(label, cx + 42, 139)
    cx += 42 + g.measureText(label).width + 28
  }
}

function build() {
  drawHeader()

  const yaws = Array.from({ length: 8 }, (_, i) => i * 45)
  // Rows 1–3: idle, stride A (contact), stride B (opposite contact).
  const rows: { mode: 'idle' | 'walk'; phase?: number; name: string }[] = [
    { mode: 'idle', name: 'idle' },
    { mode: 'walk', phase: Math.PI / 2, name: 'stride A' },
    { mode: 'walk', phase: (3 * Math.PI) / 2, name: 'stride B' },
  ]
  rows.forEach((row, r) => {
    yaws.forEach((deg, col) => {
      const char = posed({
        yaw: CAM_AZ + THREE.MathUtils.degToRad(deg),
        mode: row.mode,
        phaseTarget: row.phase,
      })
      drawTile(renderClean(char, FRUST_H, CENTER_Y, 30), col, r, `${row.name} · yaw ${deg}°`)
    })
  })

  // Row 4: references.
  const towardCam = CAM_AZ
  drawTile(renderClean(posed({ yaw: towardCam, mode: 'idle' }), FRUST_H, CENTER_Y, 0), 0, 3, 'front · elevation 0°')
  drawTile(renderClean(posed({ yaw: towardCam + Math.PI / 2, mode: 'idle' }), FRUST_H, CENTER_Y, 0), 1, 3, 'side · elevation 0°')
  drawTile(renderClean(posed({ yaw: towardCam + Math.PI, mode: 'idle' }), FRUST_H, CENTER_Y, 0), 2, 3, 'back · elevation 0°')
  drawTile(
    renderClean(posed({ yaw: towardCam, mode: 'idle' }), 1.0, 1.28, 30),
    3, 3, 'hood close-up · elevation 30°'
  )
  drawTile(
    renderClean(posed({ yaw: towardCam, mode: 'idle', attention: new THREE.Vector3(1.8, 1.2, 0.8) }), FRUST_H, CENTER_Y, 30),
    4, 3, 'idle glance'
  )
  drawTile(
    renderClean(
      posed({ yaw: towardCam + Math.PI / 2, mode: 'walk', phaseTarget: Math.PI / 2, attention: new THREE.Vector3(-1.5, 1.2, 1.5) }),
      FRUST_H, CENTER_Y, 30
    ),
    5, 3, 'walking glance'
  )
  drawTile(renderMini(posed({ yaw: towardCam, mode: 'idle' })), 6, 3, `in-game read ×${MINI_SCALE} · idle`, true)
  drawTile(
    renderMini(posed({ yaw: towardCam + Math.PI / 2, mode: 'walk', phaseTarget: Math.PI / 2 })),
    7, 3, `in-game read ×${MINI_SCALE} · stride`, true
  )

  document.body.appendChild(sheet)
  ;(window as any).__sheetPng = sheet.toDataURL('image/png')
  ;(window as any).__sheetStatus = 'done'
}

;(window as any).__sheetStatus = 'rendering'
build()
