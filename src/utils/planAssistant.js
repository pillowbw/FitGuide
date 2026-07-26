import { generatePlan } from './planGenerator'
import {
  PLAN_SYNCED_EVENT,
  ensureCurrentWeekLog,
  getPlan,
  getProfile,
  hasBasicProfile,
  hasPlanSource,
  saveProfile,
} from './storage'

export const ALL_WEEKDAYS = [
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
  '周日',
]

const WEEKDAY_ALIASES = [
  { keys: ['周一', '星期一', '礼拜一', 'monday', 'mon'], label: '周一' },
  { keys: ['周二', '星期二', '礼拜二', 'tuesday', 'tue'], label: '周二' },
  { keys: ['周三', '星期三', '礼拜三', 'wednesday', 'wed'], label: '周三' },
  { keys: ['周四', '星期四', '礼拜四', 'thursday', 'thu'], label: '周四' },
  { keys: ['周五', '星期五', '礼拜五', 'friday', 'fri'], label: '周五' },
  { keys: ['周六', '星期六', '礼拜六', 'saturday', 'sat'], label: '周六' },
  {
    keys: ['周日', '周天', '星期日', '星期天', '礼拜日', 'sunday', 'sun'],
    label: '周日',
  },
]

function uniqueWeekdays(days = []) {
  const set = new Set(
    days.filter((day) => typeof day === 'string' && ALL_WEEKDAYS.includes(day)),
  )
  return ALL_WEEKDAYS.filter((day) => set.has(day))
}

export function detectWeekdaysInMessage(message = '') {
  const lower = message.toLowerCase()
  return WEEKDAY_ALIASES.filter((day) =>
    day.keys.some((key) => message.includes(key) || lower.includes(key)),
  ).map((day) => day.label)
}

/**
 * 识别「改计划表」意图：屏蔽某天 / 恢复某天 / 清空限制。
 * @param {string} message
 * @returns {{ type: 'block'|'unblock'|'clear', weekdays: string[] }|null}
 */
export function detectScheduleAdjustIntent(message = '') {
  const text = message.trim()
  if (!text) return null

  const weekdays = detectWeekdaysInMessage(text)
  const isRestore =
    /又能练|可以练了|可以练|恢复训练|恢复.*计划|别再屏蔽|取消限制|不用避开|不用跳过/.test(
      text,
    )
  const isSkip =
    /练不了|没法练|没时间|请假|有事|取消|跳过|去不了|改到|换一天|避开|别安排|不要安排|改计划|调整计划/.test(
      text,
    )

  if (isRestore && weekdays.length === 0) {
    return { type: 'clear', weekdays: [] }
  }

  if (isRestore && weekdays.length > 0) {
    return { type: 'unblock', weekdays }
  }

  if (weekdays.length > 0 && isSkip) {
    return { type: 'block', weekdays }
  }

  return null
}

function nextBlockedWeekdays(current, intent) {
  const existing = uniqueWeekdays(current)

  if (intent.type === 'clear') return []

  if (intent.type === 'unblock') {
    const remove = new Set(intent.weekdays)
    return existing.filter((day) => !remove.has(day))
  }

  return uniqueWeekdays([...existing, ...intent.weekdays])
}

/**
 * 应用日程约束并重写本机计划表。
 * @param {{ type: 'block'|'unblock'|'clear', weekdays: string[] }} intent
 */
export function applyScheduleAdjustment(intent) {
  const current = getProfile()
  const blockedWeekdays = nextBlockedWeekdays(current.blockedWeekdays, intent)
  const profile = saveProfile({ blockedWeekdays })
  const existing = getPlan()

  if (!existing) {
    if (hasBasicProfile(profile) && hasPlanSource(profile)) {
      const plan = generatePlan(profile)
      ensureCurrentWeekLog(plan)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(PLAN_SYNCED_EVENT, {
            detail: { plan, profile, source: 'coach' },
          }),
        )
      }
      return {
        ok: true,
        profile,
        plan,
        blockedWeekdays,
        created: true,
      }
    }

    return {
      ok: false,
      profile,
      plan: null,
      blockedWeekdays,
      reason: 'no_plan',
    }
  }

  const plan = generatePlan(profile, { reuseWeekId: existing.generatedAt })
  ensureCurrentWeekLog(plan)

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PLAN_SYNCED_EVENT, {
        detail: { plan, profile, source: 'coach' },
      }),
    )
  }

  return {
    ok: true,
    profile,
    plan,
    blockedWeekdays,
    created: false,
  }
}

/**
 * @param {ReturnType<typeof applyScheduleAdjustment>} result
 * @param {{ type: string, weekdays: string[] }} intent
 */
export function describeScheduleAdjustment(result, intent) {
  if (!result.ok) {
    if (result.reason === 'no_plan') {
      return '我记下了你的时间约束，但你还没有生成周计划。先去计划页生成一版，我就能直接改训练日。'
    }
    return '这次没能改写计划表，请稍后再试。'
  }

  const days = (result.plan?.days || [])
    .map((day) => day.day)
    .filter(Boolean)
  const dayText = days.length ? days.join('、') : '新的训练日'

  if (intent.type === 'clear') {
    return `已清除不可练日限制，并重新排好计划。当前训练日：${dayText}。`
  }

  if (intent.type === 'unblock') {
    return `已恢复 ${intent.weekdays.join('、')}，并更新了计划表。当前训练日：${dayText}。`
  }

  return `已避开 ${intent.weekdays.join('、')}，并直接改好了页面上的计划表。当前训练日：${dayText}。`
}
