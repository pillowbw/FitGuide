const PROFILE_KEY = 'fitguide_profile'
const PLAN_KEY = 'fitguide_plan'
const HISTORY_KEY = 'fitguide_workout_history'
const MAX_WEEK_LOGS = 8

/**
 * @typedef {Object} UserProfile
 * @property {'male'|'female'|'other'|''} gender
 * @property {number|null} height
 * @property {number|null} weight
 * @property {number|null} [chest]
 * @property {number|null} [waist]
 * @property {number|null} [hip]
 * @property {number|null} [bodyFat]
 * @property {string} currentBodyTypeId
 * @property {'beginner'|'advanced'|''} path
 * @property {'upper'|'core'|'lower'|'full'|''} goalRegion
 * @property {string} targetBodyTypeId
 * @property {string[]} selectedMuscleIds
 * @property {string[]} selectedExerciseIds
 */

/** @returns {UserProfile} */
export function createEmptyProfile() {
  return {
    gender: '',
    height: null,
    weight: null,
    chest: null,
    waist: null,
    hip: null,
    bodyFat: null,
    currentBodyTypeId: '',
    path: '',
    goalRegion: '',
    targetBodyTypeId: '',
    selectedMuscleIds: [],
    selectedExerciseIds: [],
  }
}

/** @returns {UserProfile} */
export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return createEmptyProfile()
    return { ...createEmptyProfile(), ...JSON.parse(raw) }
  } catch {
    return createEmptyProfile()
  }
}

export const PROFILE_CHANGED_EVENT = 'fitguide:profile-changed'
export const PLAN_SYNCED_EVENT = 'fitguide:plan-synced'

/** @param {Partial<UserProfile>} patch */
export function saveProfile(patch) {
  const next = { ...getProfile(), ...patch }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(PROFILE_CHANGED_EVENT, { detail: next }),
    )
  }
  return next
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY)
}

export function getPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function savePlan(plan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan))
  return plan
}

export function clearPlan() {
  localStorage.removeItem(PLAN_KEY)
}

/** 建档基础字段是否齐全 */
export function hasBasicProfile(profile = getProfile()) {
  return Boolean(profile.gender && profile.height && profile.weight)
}

/** 是否已有可用于排课的目标肌肉 / 部位 */
export function hasPlanSource(profile = getProfile()) {
  return Boolean(
    profile.selectedMuscleIds?.length ||
      profile.goalRegion ||
      profile.targetBodyTypeId,
  )
}

/**
 * @typedef {Object} CompletedExercise
 * @property {string} key
 * @property {string} exerciseId
 * @property {string} exerciseName
 * @property {string} day
 * @property {number} dayIndex
 * @property {string} [sessionTitle]
 * @property {string} [setsLabel]
 * @property {string} completedAt
 */

/**
 * @typedef {Object} WeekLog
 * @property {string} id
 * @property {string} weekLabel
 * @property {string} path
 * @property {string} startedAt
 * @property {string|null} closedAt
 * @property {boolean} isCurrent
 * @property {CompletedExercise[]} completed
 * @property {{ day: string, dayIndex: number, sessionTitle: string, exerciseNames: string[] }[]} daySummaries
 */

/** @returns {{ weeks: WeekLog[] }} */
export function getWorkoutHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return { weeks: [] }
    const parsed = JSON.parse(raw)
    return { weeks: Array.isArray(parsed.weeks) ? parsed.weeks : [] }
  } catch {
    return { weeks: [] }
  }
}

/** @param {{ weeks: WeekLog[] }} history */
export function saveWorkoutHistory(history) {
  const weeks = (history.weeks || []).slice(0, MAX_WEEK_LOGS)
  localStorage.setItem(HISTORY_KEY, JSON.stringify({ weeks }))
  return { weeks }
}

export function clearWorkoutHistory() {
  localStorage.removeItem(HISTORY_KEY)
}

function completionKey(dayIndex, exerciseId) {
  return `${dayIndex}:${exerciseId}`
}

function buildDaySummaries(plan) {
  return (plan?.days || []).map((day) => ({
    day: day.day,
    dayIndex: day.dayIndex,
    sessionTitle: day.sessionTitle || day.focus || '',
    exerciseNames: (day.exercises || []).map((ex) => ex.name),
  }))
}

/**
 * 确保当前计划对应一条「进行中」周记录。
 * @param {object} plan
 * @returns {WeekLog|null}
 */
export function ensureCurrentWeekLog(plan) {
  if (!plan?.generatedAt) return null

  const history = getWorkoutHistory()
  const id = plan.generatedAt
  let current = history.weeks.find((w) => w.id === id)

  if (!current) {
    // 关闭其它进行中的周
    history.weeks = history.weeks.map((w) =>
      w.isCurrent
        ? { ...w, isCurrent: false, closedAt: w.closedAt || new Date().toISOString() }
        : w,
    )
    current = {
      id,
      weekLabel: plan.weekLabel || '训练周',
      path: plan.path || '',
      startedAt: plan.generatedAt,
      closedAt: null,
      isCurrent: true,
      completed: [],
      daySummaries: buildDaySummaries(plan),
    }
    history.weeks.unshift(current)
    saveWorkoutHistory(history)
    return current
  }

  // 同步课表摘要（重新打开时）
  current = {
    ...current,
    isCurrent: true,
    weekLabel: plan.weekLabel || current.weekLabel,
    daySummaries: buildDaySummaries(plan),
  }
  history.weeks = history.weeks.map((w) =>
    w.id === id ? current : w.isCurrent ? { ...w, isCurrent: false } : w,
  )
  saveWorkoutHistory(history)
  return current
}

/** 重新生成计划前：把当前周归档（保留已勾选记录） */
export function archiveCurrentWeekLog() {
  const history = getWorkoutHistory()
  let changed = false
  history.weeks = history.weeks.map((w) => {
    if (!w.isCurrent) return w
    changed = true
    return {
      ...w,
      isCurrent: false,
      closedAt: w.closedAt || new Date().toISOString(),
    }
  })
  if (changed) saveWorkoutHistory(history)
  return history
}

/**
 * 勾选 / 取消勾选某个动作已完成。
 * @returns {{ week: WeekLog, done: boolean }}
 */
export function toggleExerciseCompleted(plan, day, exercise) {
  if (!plan || !day || !exercise) {
    return { week: null, done: false }
  }

  const week = ensureCurrentWeekLog(plan)
  const history = getWorkoutHistory()
  const key = completionKey(day.dayIndex ?? day.day, exercise.id)
  const list = [...(week.completed || [])]
  const existing = list.findIndex((item) => item.key === key)
  let done = false

  if (existing >= 0) {
    list.splice(existing, 1)
    done = false
  } else {
    list.push({
      key,
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      day: day.day,
      dayIndex: day.dayIndex,
      sessionTitle: day.sessionTitle || day.focus || '',
      setsLabel: exercise.setsLabel || '',
      completedAt: new Date().toISOString(),
    })
    done = true
  }

  const nextWeek = { ...week, completed: list }
  history.weeks = history.weeks.map((w) => (w.id === week.id ? nextWeek : w))
  saveWorkoutHistory(history)
  return { week: nextWeek, done }
}

/** 某动作是否已在当前周勾选完成 */
export function isExerciseCompleted(weekLog, dayIndex, exerciseId) {
  if (!weekLog?.completed?.length) return false
  const key = completionKey(dayIndex, exerciseId)
  return weekLog.completed.some((item) => item.key === key)
}

/** 历史周（不含当前），按时间倒序 */
export function getPastWeekLogs(limit = 6) {
  const { weeks } = getWorkoutHistory()
  return weeks
    .filter((w) => !w.isCurrent && (w.completed?.length > 0 || w.daySummaries?.length))
    .slice(0, limit)
}
