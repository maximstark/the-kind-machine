import { ledger } from './ledger'

// The flourish system: at fixed slots, one sentence in the machine's voice
// referencing actual player behavior. The request fires when a walk phase
// begins so the line is ready before the slot arrives. Hard timeout, regex
// gate, scripted fallback — the player never waits on the network.

const TIMEOUT_MS = 4000
const MAX_LEN = 160

interface Slot {
  line: string | null
  settled: boolean
}

class Flourish {
  private slots = new Map<string, Slot>()

  prefetch(slotId: string, sceneId: string) {
    if (this.slots.has(slotId)) return
    const slot: Slot = { line: null, settled: false }
    this.slots.set(slotId, slot)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    fetch('/api/flourish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: slotId, ledger: ledger.flourishSnapshot(sceneId) }),
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        slot.line = this.gate(data?.line)
        slot.settled = true
      })
      .catch(() => {
        slot.settled = true
      })
      .finally(() => clearTimeout(timer))
  }

  // One sentence, sane length, no newlines, no stray tags.
  private gate(line: unknown): string | null {
    if (typeof line !== 'string') return null
    const clean = line.replace(/\s+/g, ' ').trim()
    if (!clean || clean.length > MAX_LEN) return null
    if (/[<>{}[\]]/.test(clean)) return null
    const sentences = clean.split(/(?<=[.!?])\s+/)
    return sentences[0] ?? null
  }

  // Non-blocking: whatever is ready right now, or nothing.
  deliver(slotId: string): string | null {
    const slot = this.slots.get(slotId)
    if (!slot || !slot.settled) return null
    return slot.line
  }

  has(slotId: string): boolean {
    return this.slots.has(slotId)
  }

  settled(slotId: string): boolean {
    return this.slots.get(slotId)?.settled ?? false
  }
}

export const flourish = new Flourish()
