import exercises from '../data/exercises.json'
import {
  generatePlan,
  profileFingerprint,
  replaceDislikedExercisesInPlan,
} from './planGenerator'
import {
  PLAN_SYNCED_EVENT,
  ensureCurrentWeekLog,
  getPlan,
  getProfile,
  hasBasicProfile,
  hasPlanSource,
  savePlan,
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

/** 口语别名 → 动作 id */
const EXERCISE_ALIASES = [
  { keys: ['引体向上', '引体'], ids: ['pull_up'] },
  { keys: ['反手引体'], ids: ['chin_up'] },
  { keys: ['俯卧撑', '伏地挺身'], ids: ['push_up'] },
  { keys: ['深蹲'], ids: ['squat', 'goblet_squat'] },
  { keys: ['硬拉'], ids: ['deadlift'] },
  { keys: ['卧推'], ids: ['bench_press', 'dumbbell_chest_press'] },
  {
    keys: ['划船'],
    ids: ['seated_cable_row', 'barbell_row', 'dumbbell_row', 'inverted_row'],
  },
  { keys: ['高位下拉', '下拉'], ids: ['lat_pulldown'] },
]

function uniqueWeekdays(days = []) {
  const set = new Set(
    days.filter((day) => typeof day === 'string' && ALL_WEEKDAYS.includes(day)),
  )
  return ALL_WEEKDAYS.filter((day) => set.has(day))
}

function uniqueIds(ids = []) {
  return [...new Set(ids.filter((id) => typeof id === 'string' && id))]
}

function exerciseNameById(id) {
  return exercises.find((ex) => ex.id === id)?.name || id
}

function dispatchPlanSynced(plan, profile) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent(PLAN_SYNCED_EVENT, {
      detail: { plan, profile, source: 'coach' },
    }),
  )
}

export function detectWeekdaysInMessage(message = '') {
  const lower = message.toLowerCase()
  return WEEKDAY_ALIASES.filter((day) =>
    day.keys.some((key) => message.includes(key) || lower.includes(key)),
  ).map((day) => day.label)
}

/**
 * 从用户话里找出提到的动作 id（优先匹配更长的动作名）。
 * @param {string} message
 * @param {ReturnType<typeof getPlan>} [plan]
 */
export function detectExerciseIdsInMessage(message = '', plan = getPlan()) {
  const text = message.trim()
  if (!text) return []

  const found = new Set()

  const catalog = [
    ...exercises.map((ex) => ({ id: ex.id, name: ex.name })),
    ...(plan?.days || []).flatMap((day) =>
      (day.exercises || []).map((ex) => ({
        id: ex.id,
        name: ex.name || '',
      })),
    ),
  ]
    .filter((item) => item.id && item.name)
    .sort((a, b) => b.name.length - a.name.length)

  for (const item of catalog) {
    if (text.includes(item.name)) {
      found.add(item.id)
    }
  }

  for (const alias of EXERCISE_ALIASES) {
    if (!alias.keys.some((key) => text.includes(key))) continue

    const inPlanIds = alias.ids.filter((id) =>
      (plan?.days || []).some((day) =>
        (day.exercises || []).some((ex) => ex.id === id),
      ),
    )

    if (inPlanIds.length > 0) {
      inPlanIds.forEach((id) => found.add(id))
    } else if (![...found].some((id) => alias.ids.includes(id))) {
      found.add(alias.ids[0])
    }
  }

  return [...found]
}

/**
 * 识别「换掉不喜欢的动作」意图。
 * @param {string} message
 * @returns {{ type: 'dislike'|'undislike'|'clear_dislikes', exerciseIds: string[] }|null}
 */
export function detectExerciseSwapIntent(message = '') {
  const text = message.trim()
  if (!text) return null

  const exerciseIds = detectExerciseIdsInMessage(text)
  const isClearAll =
    /清空不喜欢|取消所有不喜欢|不喜欢的动作都取消|恢复所有动作/.test(text)
  const isRestore =
    /又能做|可以做了|可以做|恢复.*动作|别排除|取消不喜欢|不再排除|重新加入/.test(
      text,
    )
  const isDislike =
    /不喜欢|讨厌|不想做|做不来|换掉|换成|换一个|换成别的|别再安排|不要安排|太难了|受不了|改成|替代|换成其他|换成别的动作/.test(
      text,
    )

  if (isClearAll) {
    return { type: 'clear_dislikes', exerciseIds: [] }
  }

  if (isRestore && exerciseIds.length > 0) {
    return { type: 'undislike', exerciseIds }
  }

  if (isDislike && exerciseIds.length > 0) {
    return { type: 'dislike', exerciseIds }
  }

  return null
}

/**
 * 识别「改计划表」意图：屏蔽某天 / 恢复某天 / 清空限制。
 * @param {string} message
 * @returns {{ type: 'block'|'unblock'|'clear', weekdays: string[] }|null}
 */
export function detectScheduleAdjustIntent(message = '') {
  const text = message.trim()
  if (!text) return null

  // 换动作意图优先，避免「不想做引体」被日程规则误伤
  if (detectExerciseSwapIntent(text)) return null

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

function nextDislikedExerciseIds(current, intent) {
  const existing = uniqueIds(current)

  if (intent.type === 'clear_dislikes') return []

  if (intent.type === 'undislike') {
    const remove = new Set(intent.exerciseIds)
    return existing.filter((id) => !remove.has(id))
  }

  return uniqueIds([...existing, ...intent.exerciseIds])
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
      dispatchPlanSynced(plan, profile)
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
  dispatchPlanSynced(plan, profile)

  return {
    ok: true,
    profile,
    plan,
    blockedWeekdays,
    created: false,
  }
}

/**
 * 记下不喜欢的动作，并在当前计划里原地替换。
 * @param {{ type: 'dislike'|'undislike'|'clear_dislikes', exerciseIds: string[] }} intent
 */
export function applyExerciseSwap(intent) {
  const current = getProfile()
  const dislikedExerciseIds = nextDislikedExerciseIds(
    current.dislikedExerciseIds,
    intent,
  )
  const profile = saveProfile({ dislikedExerciseIds })
  const existing = getPlan()

  if (!existing) {
    return {
      ok: true,
      profile,
      plan: null,
      replacements: [],
      dislikedExerciseIds,
      rememberedOnly: true,
      reason: 'no_plan',
    }
  }

  if (intent.type === 'undislike' || intent.type === 'clear_dislikes') {
    const nextPlan = savePlan({
      ...existing,
      profileFingerprint: profileFingerprint(profile),
    })
    ensureCurrentWeekLog(nextPlan)
    dispatchPlanSynced(nextPlan, profile)
    return {
      ok: true,
      profile,
      plan: nextPlan,
      replacements: [],
      dislikedExerciseIds,
      restored: true,
    }
  }

  const { plan: swapped, replacements } = replaceDislikedExercisesInPlan(
    existing,
    profile,
    intent.exerciseIds,
  )
  // 原地替换不改 fingerprint 主体字段；显式写入以便一致性
  const plan = savePlan({
    ...swapped,
    profileFingerprint: profileFingerprint(profile),
  })
  ensureCurrentWeekLog(plan)
  dispatchPlanSynced(plan, profile)

  return {
    ok: true,
    profile,
    plan,
    replacements,
    dislikedExerciseIds,
    rememberedOnly: replacements.length === 0,
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

/**
 * @param {ReturnType<typeof applyExerciseSwap>} result
 * @param {{ type: string, exerciseIds: string[] }} intent
 */
export function describeExerciseSwap(result, intent) {
  const names = (intent.exerciseIds || []).map(exerciseNameById)

  if (intent.type === 'clear_dislikes') {
    return '已清空「不喜欢的动作」名单。之后重新生成计划时可以再次出现这些动作。'
  }

  if (intent.type === 'undislike') {
    return `已把 ${names.join('、')} 移出不喜欢名单。若要重新排进课表，可以说「重新生成计划」或在计划页点重新生成。`
  }

  if (result.reason === 'no_plan' || result.rememberedOnly) {
    return `已记下你不喜欢 ${names.join('、')}。当前计划里没有这些动作；之后生成/重排时会自动避开，并换成同类替代。`
  }

  if (!result.replacements?.length) {
    return `已记下不喜欢 ${names.join('、')}，但暂时没找到合适的替代动作可换。你可以再告诉我更想练哪种（器械/自重）。`
  }

  const lines = result.replacements.map(
    (item) => `- ${item.day}：${item.fromName} → ${item.toName}`,
  )
  return `已把不喜欢的动作换成同类替代，并更新了页面计划表：\n${lines.join('\n')}`
}
