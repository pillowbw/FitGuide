import { getProfile } from './storage'

const MAX_MESSAGE_LENGTH = 2000

const PROFILE_FIELDS = [
  'gender',
  'height',
  'weight',
  'chest',
  'waist',
  'hip',
  'bodyFat',
  'currentBodyTypeId',
  'path',
  'goalRegion',
  'targetBodyTypeId',
  'selectedMuscleIds',
]

/**
 * @param {import('./storage').UserProfile} profile
 */
export function pickProfileForCoach(profile = getProfile()) {
  /** @type {Record<string, unknown>} */
  const picked = {}

  for (const key of PROFILE_FIELDS) {
    if (key === 'selectedMuscleIds') {
      picked[key] = Array.isArray(profile.selectedMuscleIds)
        ? profile.selectedMuscleIds
        : []
      continue
    }

    picked[key] = profile[key] ?? (key.includes('Id') || key === 'path' || key === 'gender' || key === 'goalRegion' ? '' : null)
  }

  return picked
}

/**
 * @param {object} params
 * @param {string} params.message
 * @param {string|null} [params.previousResponseId]
 * @param {Record<string, unknown>} [params.profile]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ text: string, responseId: string|null }>}
 */
export async function sendFitnessCoachMessage({
  message,
  previousResponseId = null,
  profile = pickProfileForCoach(),
  signal,
}) {
  const trimmed = message.trim()

  if (!trimmed) {
    throw new Error('请输入你想咨询的问题。')
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`问题过长，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。`)
  }

  const response = await fetch('/api/fitness-chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: trimmed,
      previousResponseId,
      profile,
    }),
    signal,
  })

  let payload = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const errorMessage =
      payload && typeof payload.error === 'string'
        ? payload.error
        : '网络或服务异常，请稍后再试。'
    throw new Error(errorMessage)
  }

  if (!payload || typeof payload.text !== 'string') {
    throw new Error('AI 教练返回格式异常，请稍后再试。')
  }

  return {
    text: payload.text,
    responseId:
      typeof payload.responseId === 'string' ? payload.responseId : null,
  }
}

export { MAX_MESSAGE_LENGTH }
