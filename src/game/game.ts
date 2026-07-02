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
import { voice } from './machine'
import { quizController } from './quiz'
import { SCRIPT, pick } from './script'
import { flourish } from './flourish'
import { sound } from '../audio/sound'
import type { GameScene, SceneContext } from './scenes/types'

export type GameState =
  | 'title'
  | 'cold-open'
  | 'draw-in'
  | 'explore'
  | 'dissolve-out'
  | 'quiz'
  | 'dissolve-in'
  | 'ending'
  | 'outro'

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
  private queuedExamine: string | null = null
  private mutationApplied = false
  private quizDone = false
  private stateT = 0 // seconds in current state
  private now = 0
  private sceneEnterT = 0
  private travel: (() => GameScene) | null = null
  private choicePrompt: { options: string[]; cb: (picked: string) => void } | null = null
  private outroT = 0
  private finished = false
  // Flourish slots waiting to speak, oldest first.
  private slotQueue: { id: string; notBefore: number; fallback: boolean }[] = []
  // Called when the player leaves through the waymark after the quiz.
  onAdvance: (() => void) | null = null

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
    scene.three.add(this.player.object, this.player.puffs)
    this.player.setGrid(scene.grid, scene.spawnCell)
    this.camTarget.copy(this.player.object.position)
    this.rig.frameWidth(this.camTarget.clone().setY(0.5), scene.viewWidth)
    this.mutationApplied = false
    this.quizDone = false
    atmosphere.baseline = scene.weather ?? 0
    this.sceneEnterT = this.now
    // The request fires as the walk phase begins; the line is ready
    // before its slot arrives.
    if (scene.details.length) {
      flourish.prefetch(`entry:${scene.id}`, scene.id)
      this.slotQueue = [{ id: `entry:${scene.id}`, notBefore: this.now + 14, fallback: true }]
    } else {
      this.slotQueue = []
    }
  }

  setState(s: GameState) {
    this.state = s
    this.stateT = 0
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
      if (this.finished) {
        location.reload()
        return
      }
      bus.emit('game:begin')
      this.beginColdOpen()
      return
    }
    if (this.state === 'cold-open') {
      voice.skip()
      return
    }
    if (this.state === 'quiz') {
      if (!quizController.handleTap(this.overlay, clientX, clientY)) voice.skip()
      return
    }
    if (this.state === 'ending') {
      if (this.choicePrompt) {
        const id = this.overlay.hitCard(clientX, clientY)
        if (id) {
          const cb = this.choicePrompt.cb
          this.choicePrompt = null
          voice.clear()
          cb(id)
          return
        }
      }
      voice.skip()
      return
    }
    if (this.state !== 'explore') {
      bus.emit('game:tap', { clientX, clientY })
      return
    }

    const rt = this.clientToRt(clientX, clientY)

    // 1. The waymark. Tapping it from afar walks you to it first —
    // the mark is met, not commanded.
    const wm = this.worldToRt(this.scene.waymark)
    if (wm.visible && dist(rt, wm) < 22 && this.waymarkReady()) {
      if (this.player.object.position.distanceTo(this.scene.waymark) > 4.5) {
        this.queuedExamine = null
        this.player.onArrive = () => this.onWaymarkTap()
        this.player.walkTo(this.scene.grid.worldToCell(this.scene.waymark))
      } else {
        this.onWaymarkTap()
      }
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
    if (this.scene.handleExamine?.(id, this.sceneContext())) {
      this.maybeShift(id)
      return
    }
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

  // --- intro ---

  private beginColdOpen() {
    this.setState('cold-open')
    const lines = SCRIPT.coldOpen
    let i = 0
    const next = () => {
      if (this.state !== 'cold-open') return
      if (i < lines.length) {
        const line = lines[i++]
        voice.say(line, { onDone: next, yFrac: 0.46, hold: 0.9 + line.length * 0.012 })
      } else {
        this.setState('draw-in')
      }
    }
    next()
  }

  // --- waymark gate: look before you are asked ---

  private waymarkAnnounced = false

  private waymarkReady(): boolean {
    if (this.scene.waymarkActive) return this.scene.waymarkActive()
    if (this.quizDone || this.scene.details.length === 0) return true
    const looked = ledger.examines.filter((e) => e.sceneId === this.scene.id).length
    const lingered = (ledger.sceneTimes.get(this.scene.id) ?? 0) > 75_000
    return looked >= 2 || lingered
  }

  // --- quiz flow ---

  private onWaymarkTap() {
    if (this.scene.waymarkActive && !this.scene.waymarkActive()) return
    if (this.scene.finale) {
      if (this.quizDone) return
      this.quizDone = true
      this.player.stop()
      voice.clear()
      this.setState('ending')
      this.scene.finale(this.sceneContext())
      return
    }
    if (this.quizDone) {
      voice.say(pick(SCRIPT.waymarkDone), { onDone: () => this.onAdvance?.() })
      return
    }
    this.player.stop()
    voice.clear()
    flourish.prefetch(`post:${this.scene.id}`, this.scene.id)
    bus.emit('dissolve:out')
    this.setState('dissolve-out')
  }

  // The figure glances at whatever is worth glancing at.
  private updateAttention() {
    const pos = this.player.object.position
    let best: THREE.Vector3 | null = null
    let bestD = 5.5
    for (const [, a] of this.scene.anchors) {
      if (!a.examinable || a.sky) continue
      const d = pos.distanceTo(a.object.position)
      if (d < bestD) {
        bestD = d
        best = a.object.position
      }
    }
    for (const pe of this.scene.plainExamines) {
      const d = pos.distanceTo(pe.object.position)
      if (d < bestD) {
        bestD = d
        best = pe.object.position
      }
    }
    if (!best && this.waymarkReady()) {
      const d = pos.distanceTo(this.scene.waymark)
      if (d < 9) best = this.scene.waymark
    }
    this.player.character.lookToward(best)
  }

  // Speak a queued flourish when its slot arrives and the voice is free.
  private speakSlots() {
    const s = this.slotQueue[0]
    if (!s || this.now < s.notBefore || voice.busy) return
    if (flourish.settled(s.id)) {
      this.slotQueue.shift()
      const line = flourish.deliver(s.id) ?? (s.fallback ? pick(SCRIPT.fallbackFlourish) : null)
      if (line) voice.say(line)
    } else if (this.now > s.notBefore + 6) {
      this.slotQueue.shift()
      if (s.fallback) voice.say(pick(SCRIPT.fallbackFlourish))
    }
  }

  // What scenes may ask of the game.
  sceneContext(): SceneContext {
    return {
      say: (text, opts) => voice.say(text, opts),
      caption: (text) => this.showCaption(text),
      beat: (v) => bus.emit('beat', v),
      choice: (options, cb) => {
        this.choicePrompt = { options, cb }
      },
      endGame: (kind) => this.endGame(kind),
    }
  }

  travelTo(builder: () => GameScene) {
    this.player.stop()
    voice.clear()
    this.travel = builder
    bus.emit('dissolve:out')
    this.setState('dissolve-out')
  }

  private endGame(kind: 'accept' | 'keep') {
    this.finished = true
    atmosphere.baseline = kind === 'accept' ? 0 : 0.3
    if (kind === 'accept') atmosphere.becalm()
    // One line before the ink runs out. Never confirmed, never explained.
    voice.say('Thank you for helping me remember.', {
      // DRAFT
      hold: 3.2,
      onDone: () => {
        this.setState('outro')
        this.outroT = 0
      },
    })
  }

  private applyReentry() {
    const a = ledger.assignments.get(this.scene.id)
    if (a?.lie && a.lieClaim) {
      const rec = ledger.quiz.find((q) => q.sceneId === this.scene.id && q.detailId === a.lie)
      if (rec?.agreedWithMachine) {
        // The scene redraws with the account you shared.
        ledger.redraw(a.lie, a.lieClaim)
        this.scene.applyDetailState(a.lie, a.lieClaim)
      }
    }
    this.scene.onReentry?.()
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
    sound.update()
    this.pipeline.disturb = atmosphere.amplitude
    // At higher amplitudes the interface is weather too.
    this.pipeline.uiDisturb = Math.max(0, atmosphere.amplitude - 0.35) * 0.8
    // The render is least stable around the machine's locus.
    if ((this.state === 'explore' || this.state === 'ending') && this.waymarkReady()) {
      const lp = this.worldToRt(this.scene.waymark.clone().setY(1.3))
      this.pipeline.setLocus(lp.x, lp.y, lp.visible ? 0.32 : 0)
    } else {
      this.pipeline.setLocus(-999, -999, 0)
    }
    this.scene?.update?.(dt, t)

    voice.update(dt)
    quizController.update(dt)

    if (this.state === 'draw-in') {
      this.pipeline.dissolve = Math.max(0, 1 - this.stateT / 2.2)
      if (this.stateT >= 2.4) {
        this.setState('explore')
        this.waymarkAnnounced = false
        voice.say(this.scene.entryLine)
        bus.emit('scene:entered', this.scene.id)
      }
    }

    if (this.state === 'dissolve-out') {
      this.pipeline.dissolve = Math.min(1, this.stateT / 1.6)
      if (this.stateT >= 1.9) {
        if (this.travel) {
          const builder = this.travel
          this.travel = null
          this.loadScene(builder())
          this.setState('draw-in')
        } else {
          // If the world still owes a change, it happens in the dark.
          if (this.mutationPending) this.applyShift()
          this.setState('quiz')
          quizController.start(this.scene, () => {
            this.applyReentry()
            this.quizDone = true
            bus.emit('dissolve:in')
            this.setState('dissolve-in')
          })
        }
      }
    }

    if (this.state === 'ending') {
      // The hall breathes while the account is read.
      this.player.update(dt, t)
      this.camTarget.lerp(this.scene.waymark.clone().setY(0.5), 1 - Math.exp(-dt * 0.8))
      this.rig.moveCenter(this.camTarget.clone())
    }

    if ((this.state === 'explore' || this.state === 'ending') && this.scene.viewWidthAt) {
      const targetW = this.scene.viewWidthAt(this.player.object.position)
      const curW = this.rig.getViewWidth()
      this.rig.setViewWidth(curW + (targetW - curW) * (1 - Math.exp(-dt * 1.6)))
    }

    if (this.state === 'outro') {
      this.outroT += dt
      this.pipeline.dissolve = Math.min(1, this.outroT / 4.5)
      if (this.outroT > 6) {
        this.setState('title')
        this.pipeline.dissolve = 1
      }
    }

    if (this.state === 'dissolve-in') {
      this.pipeline.dissolve = Math.max(0, 1 - this.stateT / 1.8)
      if (this.stateT >= 2.0) {
        this.setState('explore')
        voice.say(pick(SCRIPT.reentryLook))
        this.slotQueue.push({ id: `post:${this.scene.id}`, notBefore: this.now + 8, fallback: false })
        bus.emit('scene:reentered', this.scene.id)
      }
    }

    if (this.state === 'explore') {
      this.player.update(dt, t)
      this.updateAttention()
      this.logSeen(dt)
      this.speakSlots()
      // Announce the mark the moment the gate opens.
      if (!this.waymarkAnnounced && !this.quizDone && !this.scene.waymarkActive && this.scene.details.length > 0 && this.waymarkReady()) {
        this.waymarkAnnounced = true
        voice.say(pick(SCRIPT.waymarkFirst))
      }
      ledger.sceneTimes.set(
        this.scene.id,
        (ledger.sceneTimes.get(this.scene.id) ?? 0) + dt * 1000
      )
      // Camera follows, led toward the scene's heart.
      const lookAt = this.player.object.position.clone()
      if (this.scene.camBias) lookAt.add(this.scene.camBias)
      this.camTarget.lerp(lookAt, 1 - Math.exp(-dt * 3))
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
      if (wm.visible && this.waymarkReady()) {
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

    if (this.state === 'quiz') {
      quizController.draw(o)
    }

    if (this.state === 'ending' && this.choicePrompt) {
      const opts = this.choicePrompt.options
      const w = o.w - 56
      const h = 38
      const gap = 12
      const y0 = Math.round(o.h * 0.5 - (opts.length * h + (opts.length - 1) * gap) / 2)
      opts.forEach((opt, i) => {
        o.card(opt, opt, 28, y0 + i * (h + gap), w, h, {})
      })
    }

    voice.draw(o)

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

