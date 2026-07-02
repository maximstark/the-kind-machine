import { ledger } from './ledger'
import { trust } from './trust'
import { voice } from './machine'
import { SCRIPT, pick, fill } from './script'
import { bus } from '../core/bus'
import type { Overlay } from '../ui/overlay'
import type { GameScene } from './scenes/types'

// The memory quiz. The machine responds per the three-source doubt system:
// its claim on the lie-detail is false; on the mutation-detail it reads the
// world as it now stands; elsewhere it is exactly honest.

type Phase = 'intro' | 'ask' | 'cards' | 'respond' | 'done'

export class QuizController {
  private scene!: GameScene
  private order: string[] = []
  private index = 0
  private phase: Phase = 'done'
  private onComplete: (() => void) | null = null
  private cardsAlpha = 0
  private selected: string | null = null
  private resistedLie = false

  start(scene: GameScene, onComplete: () => void) {
    this.scene = scene
    this.onComplete = onComplete
    const a = ledger.assignments.get(scene.id)!
    this.order = a.quizOrder
    this.index = 0
    this.phase = 'intro'
    this.resistedLie = false
    voice.clear()
    voice.say(pick(SCRIPT.quizIntro), { onDone: () => this.askNext() })
  }

  get active() {
    return this.phase !== 'done'
  }

  get currentPhase() {
    return this.phase
  }

  get currentDetailId(): string | null {
    return this.order[this.index] ?? null
  }

  private get detailId() {
    return this.order[this.index]
  }

  private askNext() {
    if (this.index >= this.order.length) {
      this.finish()
      return
    }
    this.phase = 'ask'
    this.cardsAlpha = 0
    this.selected = null
    const spec = ledger.specOf(this.detailId)
    voice.say(spec.question, {
      hold: 999, // question stays up while cards are open
      yFrac: 0.22,
      onDone: () => {},
    })
    // Cards appear shortly after the question begins revealing.
    setTimeout(() => {
      if (this.phase === 'ask') this.phase = 'cards'
    }, Math.min(2400, spec.question.length * 38))
  }

  // What the machine asserts for a given detail this scene.
  private machineClaim(detailId: string): string {
    const a = ledger.assignments.get(this.scene.id)!
    if (a.lie === detailId && a.lieClaim) return a.lieClaim
    return ledger.stateOf(detailId) // current truth: honest, and honest-about-shifts
  }

  handleTap(overlay: Overlay, clientX: number, clientY: number): boolean {
    if (this.phase !== 'cards') return false
    const id = overlay.hitCard(clientX, clientY)
    if (!id) return false
    this.answer(id)
    return true
  }

  private answer(option: string) {
    this.phase = 'respond'
    this.selected = option
    bus.emit('quiz:card-picked')
    const detailId = this.detailId
    const role = ledger.roleOf(this.scene.id, detailId)
    const claim = this.machineClaim(detailId)
    const rec = ledger.recordAnswer(this.scene.id, detailId, option, claim)

    let line: string
    const vars = { answer: option, claim }
    if (role === 'lie') {
      if (rec.agreedWithMachine) {
        line = fill(pick(SCRIPT.lieAgree), vars)
        trust.adjust(+0.2)
      } else {
        line = fill(pick(SCRIPT.lieResist), vars)
        trust.adjust(-0.15)
        this.resistedLie = true
      }
      bus.emit('beat', 0.55)
    } else if (role === 'mutation') {
      if (rec.playerMatchedNow) {
        line = fill(pick(SCRIPT.mutationMatchNow), vars)
        trust.adjust(+0.08)
      } else {
        line = fill(pick(SCRIPT.mutationMismatch), vars)
        trust.adjust(rec.playerMatchedFirstSight ? -0.05 : 0)
      }
    } else {
      if (rec.playerMatchedNow) {
        line = this.resistedLie
          ? pick(SCRIPT.honestRightAfterResist)
          : pick(SCRIPT.honestRight)
        trust.adjust(+0.05)
      } else {
        line = fill(pick(SCRIPT.honestWrong), { answer: option, claim: ledger.stateOf(detailId) })
        trust.adjust(+0.02)
      }
    }

    // Clear the standing question, then respond.
    voice.clear()
    voice.say(line, {
      onDone: () => {
        this.index++
        this.askNext()
      },
    })
  }

  private finish() {
    this.phase = 'done'
    voice.say(pick(SCRIPT.postQuiz[trust.band]), {
      onDone: () => this.onComplete?.(),
    })
  }

  update(dt: number) {
    if (this.phase === 'cards' && this.cardsAlpha < 1) {
      this.cardsAlpha = Math.min(1, this.cardsAlpha + dt * 3.2)
    }
  }

  draw(overlay: Overlay) {
    if (this.phase !== 'cards' && this.phase !== 'respond') return
    const spec = ledger.specOf(this.detailId)
    const n = spec.options.length
    const w = overlay.w - 56
    const h = 34
    const gap = 10
    const totalH = n * h + (n - 1) * gap
    const y0 = Math.round(overlay.h * 0.58 - totalH / 2)
    spec.options.forEach((opt, i) => {
      const isSel = this.selected === opt
      const alpha = this.phase === 'respond' ? (isSel ? 0.9 : 0.15) : this.cardsAlpha
      overlay.card(opt, opt, 28, y0 + i * (h + gap), w, h, { selected: isSel, alpha })
    })
  }
}

export const quizController = new QuizController()
