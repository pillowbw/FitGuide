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
  if (!plan?.days?.length) return []

  const dayByLabel = new Map(plan.days.map((day) => [day.day, day]))
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
        goal: trainingDay.sessionTitle || trainingDay.focus || '训练',
        dayIndex: trainingDay.dayIndex,
        exercises: (trainingDay.exercises || []).map((exercise) => ({
          id: exercise.id,
          name: exercise.name,
          anchorId: getExerciseAnchorId(trainingDay.dayIndex, exercise.id),
        })),
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
      goal: '恢复',
      dayIndex: null,
      exercises: [],
      restHint,
    }
  })
}

export { WEEK_DAYS }
