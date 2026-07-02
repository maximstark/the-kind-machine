import * as THREE from 'three'
import { Pipeline } from '../core/pipeline'
import { IsoRig } from '../core/isoCamera'
import { Overlay, FONT_MACHINE } from '../ui/overlay'
import { Input } from '../core/input'
import { atmosphere } from '../core/atmosphere'
import { bus } from '../core/bus'
import { CSS } from '../core/palette'
import { ledger } from './ledger'
import { Player } from './player'
import { Grid } from './grid'
import type { GameScene } from './scenes/types'

export type GameState =
  | 'title'
  | 'draw-in'
  | 'explore'
  | 'dissolve-out'
  | 'quiz'
  | 'dissolve-in'
  | 'ending'

const CAPTION_SECONDS = 3.8
const EXAMINE_RANGE = 2.4

export class Game {
  readonly pipeline: Pipeline
  readonly rig: IsoRig
  readonly overlay: Overlay
  readonly input: Input
  readonly player: Player

  state: GameState = 'title'
  scene!: GameScene
  private raycaster = new THREE.Raycaster()
  private camTarget = new THREE.Vector3()
  private caption: { text: string; until: number } | null = null
  private machineLine: { text: string; until: number } | null = null
  private queuedExamine: string | null = null
  private mutationApplied = false
  private stateT = 0 // seconds in current state
  private now = 0
  private sceneEnterT = 0
  onWaymark: (() => void) | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.pipeline = new Pipeline(canvas)
    this.rig = new IsoRig()
    this.overlay = new Overlay(this.pipeline)
    this.input = new Input(canvas)
    this.rig.distance = 30
    this.rig.setAspect(this.pipeline.rtWidth / this.pipeline.rtHeight)
    this.pipeline.onResize = (w, h) => this.rig.setAspect(w / h)
    this.player = new Player(new Grid(2, 2), { cx: 0, cz: 0 })
    this.input.onTap = (x, y) => this.handleTap(x, y)
    this.pipeline.dissolve = 1
  }

  loadScene(scene: GameScene) {
    this.scene = scene
    ledger.registerScene(scene.id, scene.details)
    ledger.assign(scene.id, scene.quiz)
    scene.three.add(this.player.object)
    this.player.setGrid(scene.grid, scene.spawnCell)
    this.camTarget.copy(this.player.object.position)
    this.rig.frameWidth(this.camTarget.clone().setY(0.5), scene.viewWidth)
    this.mutationApplied = false
    this.sceneEnterT = this.now
  }

  setState(s: GameState) {
    this.state = s
    this.stateT = 0
  }

  say(text: string, seconds = 6) {
    this.machineLine = { text, until: this.now + seconds }
  }

  showCaption(text: string) {
    this.caption = { text, until: this.now + CAPTION_SECONDS }
  }

  // --- coordinate helpers ---

  private clientToNdc(x: number, y: number) {
    return new THREE.Vector2((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1)
  }

  worldToRt(v: THREE.Vector3): { x: number; y: number; visible: boolean } {
    const p = v.clone().project(this.rig.cam)
    return {
      x: ((p.x + 1) / 2) * this.pipeline.rtWidth,
      y: ((1 - p.y) / 2) * this.pipeline.rtHeight,
      visible: p.x > -1.05 && p.x < 1.05 && p.y > -1.05 && p.y < 1.05,
    }
  }

  private clientToRt(x: number, y: number) {
    return {
      x: (x / window.innerWidth) * this.pipeline.rtWidth,
      y: (y / window.innerHeight) * this.pipeline.rtHeight,
    }
  }

  private groundPoint(clientX: number, clientY: number): THREE.Vector3 | null {
    this.raycaster.setFromCamera(this.clientToNdc(clientX, clientY), this.rig.cam)
    const o = this.raycaster.ray.origin
    const d = this.raycaster.ray.direction
    if (Math.abs(d.y) < 1e-5) return null
    const t = -o.y / d.y
    if (t < 0) return null
    return o.clone().addScaledVector(d, t)
  }

  // --- input ---

  private handleTap(clientX: number, clientY: number) {
    if (this.state === 'title') {
      bus.emit('game:begin')
      this.setState('draw-in')
      return
    }
    if (this.state !== 'explore') {
      bus.emit('game:tap', { clientX, clientY })
      return
    }

    const rt = this.clientToRt(clientX, clientY)

    // 1. The waymark.
    const wm = this.worldToRt(this.scene.waymark)
    if (wm.visible && dist(rt, wm) < 22) {
      this.onWaymark?.()
      return
    }

    // 2. Examinables (screen-space, finger-friendly).
    let best: { id: string; d: number } | null = null
    for (const [id, a] of this.scene.anchors) {
      if (!a.examinable) continue
      const p = this.worldToRt(anchorFocus(a.object))
      if (!p.visible) continue
      const dd = dist(rt, p)
      if (dd < 26 && (!best || dd < best.d)) best = { id, d: dd }
    }
    for (const pe of this.scene.plainExamines) {
      const p = this.worldToRt(anchorFocus(pe.object))
      if (!p.visible) continue
      const dd = dist(rt, p)
      if (dd < 26 && (!best || dd < best.d)) best = { id: pe.id, d: dd }
    }
    if (best) {
      this.tryExamine(best.id)
      return
    }

    // 3. Ground: walk.
    const gp = this.groundPoint(clientX, clientY)
    if (gp) {
      this.queuedExamine = null
      this.player.onArrive = null
      this.player.walkTo(this.scene.grid.worldToCell(gp))
    }
  }

  private tryExamine(id: string) {
    const target = this.examineObject(id)
    if (!target) return
    const d = this.player.object.position.distanceTo(target.position)
    if (d <= EXAMINE_RANGE + 0.8) {
      this.doExamine(id)
    } else {
      this.queuedExamine = id
      const cell = this.scene.grid.worldToCell(target.position)
      this.player.onArrive = () => {
        if (this.queuedExamine === id) {
          this.queuedExamine = null
          this.doExamine(id)
        }
      }
      this.player.walkTo(cell)
    }
  }

  private examineObject(id: string): THREE.Object3D | null {
    const a = this.scene.anchors.get(id)
    if (a) return a.object
    return this.scene.plainExamines.find((p) => p.id === id)?.object ?? null
  }

  private doExamine(id: string) {
    ledger.recordExamine(this.scene.id, id, this.now)
    const a = this.scene.anchors.get(id)
    if (a) {
      const spec = ledger.specOf(id)
      const state = ledger.stateOf(id)
      this.showCaption(spec.describe?.[state] ?? 'You look. You remember looking.') // DRAFT
    } else {
      const pe = this.scene.plainExamines.find((p) => p.id === id)
      if (pe) this.showCaption(pe.caption)
    }
    this.maybeShift(id)
  }

  // The world sometimes changes while attention is elsewhere.
  private maybeShift(examinedId: string) {
    const a = ledger.assignments.get(this.scene.id)
    if (!a?.mutation || this.mutationApplied || a.mutation === examinedId) return
    const anchor = this.scene.anchors.get(a.mutation)
    if (!anchor) return
    const p = this.worldToRt(anchorFocus(anchor.object))
    const nearby =
      this.player.object.position.distanceTo(anchor.object.position) < (anchor.sky ? 999 : 6)
    if (!p.visible || !nearby || anchor.sky) {
      this.applyShift()
    }
  }

  applyShift() {
    const a = ledger.assignments.get(this.scene.id)
    if (!a?.mutation || this.mutationApplied) return
    this.mutationApplied = true
    ledger.shift(a.mutation)
    this.scene.applyDetailState(a.mutation, ledger.stateOf(a.mutation))
  }

  get mutationPending(): boolean {
    const a = ledger.assignments.get(this.scene.id)
    return !!a?.mutation && !this.mutationApplied
  }

  // --- per-frame ---

  update(dt: number, t: number) {
    this.now = t
    this.stateT += dt
    atmosphere.update(dt, t)
    this.pipeline.disturb = atmosphere.amplitude
    this.scene?.update?.(dt, t)

    if (this.state === 'draw-in') {
      this.pipeline.dissolve = Math.max(0, 1 - this.stateT / 2.2)
      if (this.stateT >= 2.4) {
        this.setState('explore')
        this.say(this.scene.entryLine, 9)
        bus.emit('scene:entered', this.scene.id)
      }
    }

    if (this.state === 'explore') {
      this.player.update(dt)
      this.logSeen(dt)
      ledger.sceneTimes.set(
        this.scene.id,
        (ledger.sceneTimes.get(this.scene.id) ?? 0) + dt * 1000
      )
      // Camera follows.
      this.camTarget.lerp(this.player.object.position, 1 - Math.exp(-dt * 3))
      this.rig.moveCenter(this.camTarget.clone().setY(0.5))
    }

    this.drawOverlay(t)
  }

  private logSeen(dt: number) {
    for (const [id, a] of this.scene.anchors) {
      const p = this.worldToRt(anchorFocus(a.object))
      if (!p.visible) continue
      if (!a.sky) {
        const d = this.player.object.position.distanceTo(a.object.position)
        if (d > a.radius) continue
      }
      ledger.recordSeen(id, dt * 1000)
    }
  }

  private drawOverlay(t: number) {
    const o = this.overlay
    o.clear()

    if (this.state === 'title') {
      o.fade(1)
      o.text('THE KIND', o.w / 2, o.h * 0.3, {
        font: FONT_MACHINE,
        size: 34,
        align: 'center',
        color: CSS.bone,
      })
      o.text('MACHINE', o.w / 2, o.h * 0.3 + 38, {
        font: FONT_MACHINE,
        size: 34,
        align: 'center',
        color: CSS.bone,
      })
      const pulse = 0.5 + 0.4 * Math.sin(t * 2.2)
      o.text('touch the dark to begin', o.w / 2, o.h * 0.62, {
        size: 11,
        align: 'center',
        color: CSS.ash,
        alpha: pulse,
      })
      return
    }

    if (this.state === 'explore') {
      // Faint ink pulses over examinables.
      for (const [id, a] of this.scene.anchors) {
        if (!a.examinable) continue
        this.drawPulse(anchorFocus(a.object), t, CSS.bone)
      }
      for (const pe of this.scene.plainExamines) {
        this.drawPulse(anchorFocus(pe.object), t, CSS.bone)
      }
      // The waymark: machine-green, on the overlay, of the interface.
      const wm = this.worldToRt(this.scene.waymark)
      if (wm.visible) {
        const s = 4 + Math.sin(t * 2.4) * 1.2
        const ctx = this.pipeline.uiCtx
        ctx.save()
        ctx.translate(wm.x, wm.y)
        ctx.rotate(Math.PI / 4)
        ctx.globalAlpha = 0.75 + 0.25 * Math.sin(t * 2.4)
        ctx.fillStyle = CSS.green
        ctx.fillRect(-s / 2, -s / 2, s, s)
        ctx.restore()
        ctx.globalAlpha = 1
      }
    }

    if (this.machineLine) {
      if (t > this.machineLine.until) this.machineLine = null
      else o.machineText(this.machineLine.text)
    }
    if (this.caption) {
      if (t > this.caption.until) this.caption = null
      else o.caption(this.caption.text)
    }
  }

  private drawPulse(v: THREE.Vector3, t: number, color: string) {
    const p = this.worldToRt(v)
    if (!p.visible) return
    const ctx = this.pipeline.uiCtx
    const a = 0.25 + 0.2 * Math.sin(t * 3 + v.x)
    ctx.globalAlpha = a
    ctx.fillStyle = color
    ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2)
    ctx.globalAlpha = 1
  }

  render(t: number) {
    this.pipeline.render(this.scene.three, this.rig.cam, t)
  }
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Focus point for an object: its position lifted to mid-height so screen
// projection lands on the body, not the feet.
function anchorFocus(o: THREE.Object3D): THREE.Vector3 {
  const box = new THREE.Box3().setFromObject(o)
  if (!isFinite(box.min.x) || !isFinite(box.max.x)) return o.position.clone()
  const c = new THREE.Vector3()
  box.getCenter(c)
  return c
}

