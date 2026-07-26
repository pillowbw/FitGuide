/** @param {number} dayIndex @param {string} exerciseId */
export function getExerciseAnchorId(dayIndex, exerciseId) {
  return `plan-ex-${dayIndex}-${exerciseId}`
}

/** @param {number} dayIndex */
export function getDayAnchorId(dayIndex) {
  return `plan-day-${dayIndex}`
}

const WEEK_DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

/** 0 = 周一 … 6 = 周日 */
export function getTodayWeekdayIndex() {
  const day = new Date().getDay()
  return day === 0 ? 6 : day - 1
}

/** 按周一→周日排序训练日；非标准星期标签则按 dayIndex */
export function sortPlanDaysChronologically(days = []) {
  return [...days].sort((a, b) => {
    const ai = WEEK_DAYS.indexOf(a?.day)
    const bi = WEEK_DAYS.indexOf(b?.day)
    if (ai >= 0 && bi >= 0) return ai - bi
    if (ai >= 0) return -1
    if (bi >= 0) return 1
    return (a?.dayIndex || 0) - (b?.dayIndex || 0)
  })
}

/**
 * 整周时间线：周一→周日，训练日带完整 day，休息日带提示。
 * @param {object|null} plan
 */
export function buildWeekTimeline(plan) {
  if (!plan?.days?.length) return []

  const dayByLabel = new Map(
    sortPlanDaysChronologically(plan.days).map((day) => [day.day, day]),
  )
  const restHints = plan.restDayHints || []
  let restHintIndex = 0

  return WEEK_DAYS.map((weekday, weekdayIndex) => {
    const trainingDay = dayByLabel.get(weekday)
    if (trainingDay) {
      return {
        weekday,
        weekdayIndex,
        isToday: weekdayIndex === getTodayWeekdayIndex(),
        isRest: false,
        day: trainingDay,
        restHint: '',
      }
    }

    const restHint =
      restHints[restHintIndex % restHints.length] || '恢复训练 · 拉伸与休息'
    restHintIndex += 1

    return {
      weekday,
      weekdayIndex,
      isToday: weekdayIndex === getTodayWeekdayIndex(),
      isRest: true,
      day: null,
      restHint,
    }
  })
}

/**
 * @param {import('../utils/planGenerator').Plan|null} plan
 * @returns {Array<{
 *   weekday: string,
 *   weekdayIndex: number,
 *   isToday: boolean,
 *   isRest: boolean,
 *   goal: string,
 *   dayIndex: number|null,
 *   exercises: Array<{ id: string, name: string, anchorId: string }>,
 *   restHint: string,
 * }>}
 */
export function buildWeeklyOverviewRows(plan) {
  return buildWeekTimeline(plan).map((row) => {
    if (!row.isRest && row.day) {
      return {
        weekday: row.weekday,
        weekdayIndex: row.weekdayIndex,
        isToday: row.isToday,
        isRest: false,
        goal: row.day.sessionTitle || row.day.focus || '训练',
        dayIndex: row.day.dayIndex,
        exercises: (row.day.exercises || []).map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          anchorId: getExerciseAnchorId(row.day.dayIndex, exercise.id),
        })),
        restHint: '',
      }
    }

    return {
      weekday: row.weekday,
      weekdayIndex: row.weekdayIndex,
      isToday: row.isToday,
      isRest: true,
      goal: '恢复',
      dayIndex: null,
      exercises: [],
      restHint: row.restHint,
    }
  })
}

export { WEEK_DAYS }
