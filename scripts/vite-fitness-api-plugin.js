import { handleFitnessChat } from '../api/lib/fitnessChatHandler.js'

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''

    req.on('data', (chunk) => {
      raw += chunk
    })

    req.on('end', () => resolve(raw))
    req.on('error', reject)
  })
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

/**
 * 本地 npm run dev 时挂载 /api/fitness-chat，避免仅 Vite 前端无法访问 API。
 * @param {{ apiKey?: string, model?: string }} env
 */
export function fitnessChatDevPlugin(env = {}) {
  return {
    name: 'fitguide-fitness-chat-dev',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0]

        if (url !== '/api/fitness-chat') {
          next()
          return
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST')
          sendJson(res, 405, { error: '仅支持 POST 请求。' })
          return
        }

        try {
          const rawBody = await readRequestBody(req)
          const { status, payload } = await handleFitnessChat(rawBody, {
            apiKey: env.OPENAI_API_KEY || process.env.OPENAI_API_KEY,
            model: env.OPENAI_MODEL || process.env.OPENAI_MODEL,
            demoEnabled: (env.FITGUIDE_COACH_DEMO ?? process.env.FITGUIDE_COACH_DEMO) !== 'false',
          })
          sendJson(res, status, payload)
        } catch {
          sendJson(res, 500, { error: '本地 AI 服务异常，请重启 npm run dev。' })
        }
      })
    },
  }
}
