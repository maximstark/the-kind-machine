import { serve } from '@hono/node-server'
import app from './index'

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) }, (info) => {
  console.log(`flourish proxy on :${info.port}`)
})
