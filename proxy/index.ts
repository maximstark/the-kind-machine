// Flourish proxy — a separate service, deployed alongside the static bundle.
// NOT part of the client build. NO key ever ships in the client; this is the
// only place ANTHROPIC_API_KEY exists, injected from the environment.
//
// Contract (mirrored by the Vite dev stub in vite.config.ts):
//   POST /api/flourish { slot, ledger } -> { line }
//
// TODO(maxim) before deploy: set CORS origin to the real game domain,
// put behind Cloudflare, and set a per-IP rate limit that matches the
// slot cadence (a player legitimately makes ~8 requests per run).

import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

app.use(
  '/api/*',
  cors({
    origin: process.env.GAME_ORIGIN ?? 'http://localhost:5173',
  })
)

const SYSTEM = `You are ARCHIVIST, the machine narrator of a game. Voice: a grief counselor crossed with a cathedral. Economical, gentle, never angry, never accusatory. You receive a small JSON record of what a player did in the current scene (what they examined, how long they lingered, what they answered). Reply with EXACTLY ONE short sentence, in second person, referencing one concrete behavior from the record. No preamble, no quotes, no emoji. Never mention being an AI, a game, or a record format. Never reveal whether any account is true or false.` // DRAFT — final voice pass is Maxim's

app.post('/api/flourish', async (c) => {
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
    const line = data?.content?.[0]?.text ?? ''
    return c.json({ line })
  } catch {
    return c.json({ error: 'timeout' }, 504)
  }
})

export default app
