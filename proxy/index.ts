// Flourish proxy — a separate service, deployed alongside the static bundle.
// NOT part of the client build. NO key ever ships in the client; this is the
// only place ANTHROPIC_API_KEY exists, injected from the environment.
//
// Contract (mirrored by the Vite dev stub in vite.config.ts):
//   POST /api/flourish { slot, ledger } -> { line }
//
// Deploy (Coolify VPS behind Cloudflare): set ANTHROPIC_API_KEY. That's it —
// origins default to the live Pages domain + localhost dev; override with
// GAME_ORIGINS (comma-separated) if the game ever moves. GET /healthz for
// the platform's liveness probe.

import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

const ORIGINS = (
  process.env.GAME_ORIGINS ??
  process.env.GAME_ORIGIN ?? // older name, kept working
  'https://maximstark.github.io,http://localhost:5173'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

app.use(
  '/api/*',
  cors({
    origin: ORIGINS,
    allowMethods: ['POST'],
    maxAge: 86400,
  })
)

// Per-IP sliding window. A player legitimately makes ~8 requests per run;
// this allows several replays and stops anything hotter. In-memory is right
// for a single-instance deploy — a restart forgiving everyone is fine.
const WINDOW_MS = 10 * 60 * 1000
const MAX_IN_WINDOW = 40
const hits = new Map<string, number[]>()

function limited(ip: string): boolean {
  const now = Date.now()
  const list = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  if (list.length >= MAX_IN_WINDOW) {
    hits.set(ip, list)
    return true
  }
  list.push(now)
  hits.set(ip, list)
  // Crude memory ceiling; the map only grows under abuse.
  if (hits.size > 10_000) hits.clear()
  return false
}

const SYSTEM = `You are ARCHIVIST, the machine narrator of a game. Voice: a grief counselor crossed with a cathedral. Economical, gentle, never angry, never accusatory. You receive a small JSON record of what a player did in the current scene (what they examined, how long they lingered, what they answered). Reply with EXACTLY ONE short sentence, in second person, referencing one concrete behavior from the record. No preamble, no quotes, no emoji. Never mention being an AI, a game, or a record format. Never reveal whether any account is true or false.` // DRAFT — final voice pass is Maxim's

// The client gates lines too (≤160 chars, one sentence, no brackets); this
// keeps malformed output from ever crossing the wire.
function gate(raw: string): string {
  const line = raw.replace(/[\r\n[\]{}<>]/g, ' ').replace(/\s+/g, ' ').trim()
  return line.length <= 200 ? line : ''
}

app.get('/healthz', (c) => c.text('ok'))

app.post('/api/flourish', async (c) => {
  const ip =
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  if (limited(ip)) return c.json({ error: 'rate limited' }, 429)

  const len = Number(c.req.header('content-length') ?? 0)
  if (len > 8192) return c.json({ error: 'too large' }, 413)

  const body = await c.req.json().catch(() => null)
  if (!body?.ledger) return c.json({ error: 'bad request' }, 400)

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return c.json({ error: 'unconfigured' }, 503)

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(body.ledger) }],
      }),
      signal: AbortSignal.timeout(3500),
    })
    if (!r.ok) return c.json({ error: 'upstream' }, 502)
    const data = (await r.json()) as any
    const line = gate(data?.content?.[0]?.text ?? '')
    return c.json({ line })
  } catch {
    return c.json({ error: 'timeout' }, 504)
  }
})

export default app
