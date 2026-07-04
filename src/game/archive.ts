import { ledger } from './ledger'
import { trust } from './trust'

// What the machine keeps between visits. The post-run reload wipes the run
// state; this survives it. The archive remembers being read.
//
// Stored: a summary of the previous COMPLETED run only (the machine keeps
// its own account of you, and its account is always the latest one).
// If storage is unavailable (private mode), the machine simply gets
// amnesia — every path below degrades to first-visit behavior.

export interface PastRun {
  ending: 'accept' | 'keep'
  band: 'defiant' | 'wavering' | 'deferent'
  resistedLie: boolean
  agreedLie: boolean
  followedFalseHint: boolean
  visits: number
}

const KEY = 'tkm-archive-v1'

function load(): PastRun | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p && (p.ending === 'accept' || p.ending === 'keep')) return p as PastRun
  } catch {
    // Blocked or malformed storage: no memory, no error.
  }
  return null
}

class Archive {
  // Read once at boot: the previous completed run, if any.
  readonly lastRun: PastRun | null = load()

  // Called at the moment of choice (before the thank-you line), so a
  // closed tab after choosing still counts as a completed visit.
  record(ending: 'accept' | 'keep') {
    let resisted = false
    let agreed = false
    for (const [sceneId, a] of ledger.assignments) {
      if (!a.lie) continue
      const rec = ledger.quiz.find((q) => q.sceneId === sceneId && q.detailId === a.lie)
      if (!rec) continue
      if (rec.agreedWithMachine) agreed = true
      else resisted = true
    }
    const run: PastRun = {
      ending,
      band: trust.band,
      resistedLie: resisted,
      agreedLie: agreed,
      followedFalseHint: ledger.hintFollows.some((h) => h.followedMachine),
      visits: (this.lastRun?.visits ?? 0) + 1,
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(run))
    } catch {
      // This run will simply not be remembered.
    }
  }
}

export const archive = new Archive()
