import { handleFitnessChat } from './lib/fitnessChatHandler.js'

function jsonResponse(res, status, payload) {
  res.status(status).setHeader('Content-Type', 'application/json').json(payload)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return jsonResponse(res, 405, { error: '仅支持 POST 请求。' })
  }

  const { status, payload } = await handleFitnessChat(req.body)
  return jsonResponse(res, status, payload)
}
