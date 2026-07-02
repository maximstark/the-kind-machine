import { defineConfig, type Plugin } from 'vite'

// Dev-only stand-in for the flourish proxy service. Mirrors the real contract:
// POST /api/flourish { ledger } -> { line } with realistic latency.
// The real service lives in proxy/ and is deployed separately. No key here, ever.
function flourishStub(): Plugin {
  // DRAFT lines throughout — final voice pass is Maxim's.
  const canned = [
    'You walked the long way around. I noticed. I did not mind.', // DRAFT
    'You looked at that twice. Most people look once, or not at all.', // DRAFT
    'You hesitated before you answered. Hesitation is a kind of honesty.', // DRAFT
    'You are doing very well. Better than most who came through here.', // DRAFT
    'You kept your back to the door for a long time. I understand.', // DRAFT
    'It is all right to be unsure. That is what I am for.', // DRAFT
  ]
  let i = 0
  return {
    name: 'flourish-stub',
    configureServer(server) {
      server.middlewares.use('/api/flourish', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.on('data', (c) => (body += c))
        req.on('end', () => {
          const delay = 500 + Math.random() * 1600
          setTimeout(() => {
            const line = canned[i++ % canned.length]
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ line }))
          }, delay)
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [flourishStub()],
  server: {
    host: true,
  },
  build: {
    target: 'es2020',
  },
})
