import { getPlan, getProfile } from './storage'

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
  'blockedWeekdays',
  'dislikedExerciseIds',
  'injuries',
  'postures',
]

/**
 * @param {import('./storage').UserProfile} profile
 */
export function pickProfileForCoach(profile = getProfile()) {
  /** @type {Record<string, unknown>} */
  const picked = {}

  for (const key of PROFILE_FIELDS) {
    if (
      key === 'selectedMuscleIds' ||
      key === 'blockedWeekdays' ||
      key === 'dislikedExerciseIds' ||
      key === 'injuries' ||
      key === 'postures'
    ) {
      picked[key] = Array.isArray(profile[key]) ? profile[key] : []
      continue
    }

    picked[key] =
      profile[key] ??
      (key.includes('Id') ||
      key === 'path' ||
      key === 'gender' ||
      key === 'goalRegion'
        ? ''
        : null)
  }

  return picked
}

/**
 * 压缩当前计划，供教练做日程微调（避免把完整动作库塞进请求）。
 * @param {ReturnType<typeof getPlan>} [plan]
 */
export function pickPlanForCoach(plan = getPlan()) {
  if (!plan?.days?.length) return null

  return {
    weekLabel: plan.weekLabel || '',
    path: plan.path || '',
    goalRegion: plan.goalRegion || '',
    days: plan.days.slice(0, 7).map((day) => ({
      day: day.day || '',
      sessionTitle: day.sessionTitle || '',
      focus: day.focus || '',
      exercises: (day.exercises || []).slice(0, 8).map((ex) => ({
        name: ex.name || ex.exerciseName || '动作',
        setsLabel: ex.setsLabel || '',
      })),
    })),
  }
}

/**
 * @param {Array<{ role: string, content: string }>} messages
 * @param {string} [welcomeMessage]
 */
export function pickHistoryForCoach(messages = [], welcomeMessage = '') {
  return messages
    .filter(
      (item) =>
        (item.role === 'user' || item.role === 'assistant') &&
        typeof item.content === 'string' &&
        item.content.trim() &&
        item.content !== welcomeMessage,
    )
    .slice(-12)
    .map((item) => ({
      role: item.role,
      content: item.content.trim().slice(0, MAX_MESSAGE_LENGTH),
    }))
}

/**
 * @param {object} params
 * @param {string} params.message
 * @param {Array<{ role: string, content: string }>} [params.history]
 * @param {Record<string, unknown>} [params.profile]
 * @param {Record<string, unknown>|null} [params.plan]
 * @param {AbortSignal} [params.signal]
 * @returns {Promise<{ text: string, responseId: string|null, mode: 'ai'|'demo', action: object|null }>}
 */
export async function sendFitnessCoachMessage({
  message,
  history = [],
  profile = pickProfileForCoach(),
  plan = pickPlanForCoach(),
  signal,
}) {
  const trimmed = message.trim()

  if (!trimmed) {
    throw new Error('请输入你想咨询的问题。')
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`问题过长，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。`)
  }

  let response

  try {
    response = await fetch('/api/fitness-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: trimmed,
        history,
        profile,
        plan,
      }),
      signal,
    })
  } catch {
    throw new Error(
      '无法连接 AI 服务。请重启 npm run dev，并确认 .env.local 已配置 OPENAI_API_KEY。',
    )
  }

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
    throw new Error(
      'AI 服务未就绪。请重启 npm run dev，并检查 .env.local 是否已填写 OPENAI_API_KEY。',
    )
  }

  return {
    text: payload.text,
    responseId:
      typeof payload.responseId === 'string' ? payload.responseId : null,
    mode: payload.mode === 'ai' ? 'ai' : 'demo',
    action:
      payload.action && typeof payload.action === 'object'
        ? payload.action
        : null,
  }
}

export { MAX_MESSAGE_LENGTH }
