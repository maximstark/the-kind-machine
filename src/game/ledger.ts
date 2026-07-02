import { bus } from '../core/bus'

// The ground-truth ledger. The renderer is this object's costume.
// It records: every detail's true state over time, what the player
// plausibly saw (proximity + frustum dwell), what they examined,
// what they answered, and what the machine claimed.

export interface DetailSpec {
  id: string
  question: string // DRAFT phrasing throughout; final voice pass is Maxim's
  options: string[] // touch cards; must include both initial and mutated
  initial: string
  mutated: string
  sky?: boolean // visible from anywhere (moons); dwell needs no proximity
  describe?: Record<string, string> // examine caption per state
}

export type DetailRole = 'lie' | 'mutation' | 'honest' | 'plain'

export interface SceneAssignment {
  lie: string | null
  mutation: string | null
  honest: string | null
  quizOrder: string[]
  lieClaim: string | null
}

export interface SeenLog {
  ms: number
  firstState: string | null // state when first plausibly seen
  lastState: string | null // state when last plausibly seen
  msAfterShift: number // dwell accumulated after the state changed
}

export interface QuizRecord {
  sceneId: string
  detailId: string
  role: DetailRole
  question: string
  playerAnswer: string
  truthAtFirstSight: string | null
  truthNow: string
  machineClaim: string
  playerMatchedFirstSight: boolean
  playerMatchedNow: boolean
  agreedWithMachine: boolean
}

export interface ExamineRecord {
  sceneId: string
  targetId: string
  t: number
}

interface DetailRuntime {
  spec: DetailSpec
  sceneId: string
  state: string
  seen: SeenLog
}

export class Ledger {
  private details = new Map<string, DetailRuntime>()
  quiz: QuizRecord[] = []
  examines: ExamineRecord[] = []
  assignments = new Map<string, SceneAssignment>()
  hintFollows: { sceneId: string; followedMachine: boolean }[] = []
  sceneTimes = new Map<string, number>()

  registerScene(sceneId: string, specs: DetailSpec[]) {
    for (const s of specs) {
      this.details.set(s.id, {
        spec: s,
        sceneId,
        state: s.initial,
        seen: { ms: 0, firstState: null, lastState: null, msAfterShift: 0 },
      })
    }
  }

  // Choose which detail carries which role this scene. Scene 1 passes
  // lie: false, mutation: false — trust must be built before it is spent.
  assign(
    sceneId: string,
    opts: { lie: boolean; mutation: boolean; quizCount?: number }
  ): SceneAssignment {
    const ids = [...this.details.values()].filter((d) => d.sceneId === sceneId).map((d) => d.spec.id)
    const shuffled = [...ids].sort(() => Math.random() - 0.5)
    const lie = opts.lie ? shuffled[0] : null
    const mutation = opts.mutation ? shuffled[1] : null
    const honest = shuffled[opts.lie && opts.mutation ? 2 : opts.lie || opts.mutation ? 1 : 0]

    const quizCount = opts.quizCount ?? 3
    const roleIds = [lie, mutation, honest].filter(Boolean) as string[]
    const fillers = shuffled.filter((id) => !roleIds.includes(id))
    const quizOrder = [...roleIds, ...fillers].slice(0, quizCount).sort(() => Math.random() - 0.5)

    let lieClaim: string | null = null
    if (lie) {
      const d = this.details.get(lie)!
      lieClaim = d.spec.options.find((o) => o !== d.state) ?? d.state
    }

    const a: SceneAssignment = { lie, mutation, honest, quizOrder, lieClaim }
    this.assignments.set(sceneId, a)
    return a
  }

  roleOf(sceneId: string, detailId: string): DetailRole {
    const a = this.assignments.get(sceneId)
    if (!a) return 'plain'
    if (a.lie === detailId) return 'lie'
    if (a.mutation === detailId) return 'mutation'
    if (a.honest === detailId) return 'honest'
    return 'plain'
  }

  stateOf(detailId: string): string {
    return this.details.get(detailId)!.state
  }

  specOf(detailId: string): DetailSpec {
    return this.details.get(detailId)!.spec
  }

  seenOf(detailId: string): SeenLog {
    return this.details.get(detailId)!.seen
  }

  // The world actually changes. Quietly.
  shift(detailId: string) {
    const d = this.details.get(detailId)
    if (!d) return
    const prev = d.state
    d.state = d.spec.mutated
    bus.emit('world:shift', { detailId, from: prev, to: d.state })
    bus.emit('beat', 0.5)
  }

  // On re-entry the scene may redraw with the machine's version. From then
  // on, that version is what stands.
  redraw(detailId: string, state: string) {
    const d = this.details.get(detailId)
    if (!d || d.state === state) return
    const prev = d.state
    d.state = state
    bus.emit('world:redraw', { detailId, from: prev, to: state })
    bus.emit('beat', 0.45)
  }

  recordSeen(detailId: string, ms: number) {
    const d = this.details.get(detailId)
    if (!d) return
    d.seen.ms += ms
    if (d.seen.firstState === null) d.seen.firstState = d.state
    d.seen.lastState = d.state
    if (d.seen.firstState !== d.state) d.seen.msAfterShift += ms
  }

  recordExamine(sceneId: string, targetId: string, t: number) {
    this.examines.push({ sceneId, targetId, t })
    bus.emit('ledger:examine', { sceneId, targetId })
  }

  recordAnswer(sceneId: string, detailId: string, playerAnswer: string, machineClaim: string): QuizRecord {
    const d = this.details.get(detailId)!
    const rec: QuizRecord = {
      sceneId,
      detailId,
      role: this.roleOf(sceneId, detailId),
      question: d.spec.question,
      playerAnswer,
      truthAtFirstSight: d.seen.firstState,
      truthNow: d.state,
      machineClaim,
      playerMatchedFirstSight: d.seen.firstState !== null && playerAnswer === d.seen.firstState,
      playerMatchedNow: playerAnswer === d.state,
      agreedWithMachine: playerAnswer === machineClaim,
    }
    this.quiz.push(rec)
    bus.emit('ledger:answer', rec)
    return rec
  }

  recordHintFollow(sceneId: string, followedMachine: boolean) {
    this.hintFollows.push({ sceneId, followedMachine })
    bus.emit('ledger:hint', { sceneId, followedMachine })
  }

  // Snapshot for the flourish endpoint: behavior only, no ground truth
  // the machine shouldn't reveal, no spoilers of roles.
  flourishSnapshot(sceneId: string) {
    return {
      scene: sceneId,
      examines: this.examines.filter((e) => e.sceneId === sceneId).map((e) => e.targetId),
      dwell: [...this.details.entries()]
        .filter(([, d]) => d.sceneId === sceneId)
        .map(([id, d]) => ({ id, ms: Math.round(d.seen.ms) })),
      answers: this.quiz.map((q) => ({
        detail: q.detailId,
        answer: q.playerAnswer,
        agreedWithMachine: q.agreedWithMachine,
      })),
      sceneSeconds: Math.round((this.sceneTimes.get(sceneId) ?? 0) / 1000),
    }
  }
}

export const ledger = new Ledger()
