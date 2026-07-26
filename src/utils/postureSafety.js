import postureRules from '../data/postureRules.json'

/** @returns {typeof postureRules.options} */
export function getPostureOptions() {
  return postureRules.options || []
}

/**
 * @param {string[]|undefined|null} postureIds
 * @returns {string[]}
 */
export function normalizePostureIds(postureIds) {
  const allowed = new Set((postureRules.options || []).map((item) => item.id))
  return [...new Set((postureIds || []).filter((id) => allowed.has(id)))]
}

/**
 * @param {string} postureId
 */
function getConstraint(postureId) {
  return postureRules.constraints?.[postureId] || null
}

/**
 * 合并体态约束：矫正动作池、规避模式、提示文案。
 * @param {string[]|undefined|null} postureIds
 */
export function resolvePostureConstraints(postureIds) {
  const ids = normalizePostureIds(postureIds)
  const correctiveExerciseIds = new Set()
  const avoidPatterns = new Set()
  const avoidExerciseIds = new Set()
  const allowExerciseIds = new Set()
  const preferMuscles = new Set()
  const notes = []
  const coachingTips = []
  let sessionFocus = ''

  for (const id of ids) {
    const rule = getConstraint(id)
    if (!rule) continue
    for (const exerciseId of rule.correctiveExerciseIds || []) {
      correctiveExerciseIds.add(exerciseId)
    }
    for (const pattern of rule.avoidPatterns || []) avoidPatterns.add(pattern)
    for (const exerciseId of rule.avoidExerciseIds || []) {
      avoidExerciseIds.add(exerciseId)
    }
    for (const exerciseId of rule.allowExerciseIds || []) {
      allowExerciseIds.add(exerciseId)
    }
    for (const muscleId of rule.preferMuscles || []) preferMuscles.add(muscleId)
    if (rule.note) notes.push(rule.note)
    if (rule.coachingTip) coachingTips.push(rule.coachingTip)
    if (rule.sessionFocus && !sessionFocus) sessionFocus = rule.sessionFocus
  }

  return {
    postureIds: ids,
    correctiveExerciseIds,
    avoidPatterns,
    avoidExerciseIds,
    allowExerciseIds,
    preferMuscles,
    notes: [...new Set(notes)],
    coachingTips: [...new Set(coachingTips)],
    sessionFocus,
  }
}

/**
 * 找出与该动作相关的体态规则（矫正池命中）。
 * @param {{ id: string }} exercise
 * @param {string[]} postureIds
 */
function findRelatedPostureRules(exercise, postureIds) {
  const related = []
  for (const id of normalizePostureIds(postureIds)) {
    const rule = getConstraint(id)
    if (!rule) continue
    if ((rule.correctiveExerciseIds || []).includes(exercise.id)) {
      related.push({ id, rule })
    }
  }
  return related
}

/**
 * 某动作是否与已选体态冲突（如腰间盘忌弯腰大重量）。
 * @param {{ id: string, pattern?: string }} exercise
 * @param {string[]|undefined|null} postureIds
 */
export function isExerciseSafeForPostures(exercise, postureIds) {
  if (!exercise?.id) return false
  const {
    avoidPatterns,
    avoidExerciseIds,
    allowExerciseIds,
    postureIds: ids,
  } = resolvePostureConstraints(postureIds)

  if (!ids.length) return true
  if (allowExerciseIds.has(exercise.id)) return true
  if (avoidExerciseIds.has(exercise.id)) return false
  if (exercise.pattern && avoidPatterns.has(exercise.pattern)) return false
  return true
}

/**
 * @param {{ id: string }} exercise
 * @param {string[]|undefined|null} postureIds
 */
export function isPostureCorrectiveExercise(exercise, postureIds) {
  const ids = normalizePostureIds(postureIds)
  if (!ids.length || !exercise?.id) return false
  return findRelatedPostureRules(exercise, ids).length > 0
}

/**
 * @param {{ id: string }} exercise
 * @param {string[]|undefined|null} postureIds
 */
export function getExercisePostureCare(exercise, postureIds) {
  const ids = normalizePostureIds(postureIds)
  if (!ids.length) {
    return {
      related: false,
      tip: '',
      careBadge: '',
      loadCue: '',
    }
  }

  const relatedRules = findRelatedPostureRules(exercise, ids)
  if (!relatedRules.length) {
    return {
      related: false,
      tip: '',
      careBadge: '',
      loadCue: '',
    }
  }

  const primary = relatedRules[0].rule
  return {
    related: true,
    tip: primary.coachingTip || '',
    careBadge: primary.careBadge || '改善体态',
    loadCue: postureRules.correctiveCue || '改善体态',
  }
}

/**
 * @param {string[]|undefined|null} postureIds
 * @param {string} [goalRegion]
 */
export function getRegionPostureHints(postureIds, goalRegion = '') {
  const ids = normalizePostureIds(postureIds)
  if (!ids.length || !goalRegion) return []

  return (postureRules.options || [])
    .filter(
      (option) =>
        ids.includes(option.id) &&
        Array.isArray(option.affectsRegions) &&
        option.affectsRegions.includes(goalRegion),
    )
    .map((option) => {
      const rule = getConstraint(option.id)
      return {
        id: option.id,
        label: option.label,
        hint: option.regionHint || option.hint,
        safeFocus: option.safeFocus || '',
        coachingTip: rule?.coachingTip || '',
      }
    })
}

/**
 * @param {string[]|undefined|null} postureIds
 * @returns {string}
 */
export function postureLabelsText(postureIds) {
  const ids = normalizePostureIds(postureIds)
  if (!ids.length) return ''
  const labelMap = new Map(
    (postureRules.options || []).map((item) => [item.id, item.label]),
  )
  return ids.map((id) => labelMap.get(id) || id).join('、')
}

/** 体态矫正组数文案 */
export function getPostureCorrectiveSetsLabel(schemeKey = 'isolation') {
  const labels = postureRules.correctiveSetsLabel || {}
  return labels[schemeKey] || labels.isolation || labels.beginner || ''
}

/**
 * 从矫正动作池里挑一个尚未用过、且对伤病/体态都安全的动作。
 * @param {object[]} exerciseCatalog
 * @param {string[]|undefined|null} postureIds
 * @param {Set<string>} weekUsed
 * @param {Set<string>} dayUsed
 * @param {(ex: object) => boolean} [extraSafe]
 * @param {number} [dayIndex]
 */
export function pickCorrectiveExercise(
  exerciseCatalog,
  postureIds,
  weekUsed,
  dayUsed,
  extraSafe = () => true,
  dayIndex = 0,
) {
  const { correctiveExerciseIds, postureIds: ids } =
    resolvePostureConstraints(postureIds)
  if (!ids.length || !correctiveExerciseIds.size) return null

  const pool = exerciseCatalog.filter((ex) => {
    if (!correctiveExerciseIds.has(ex.id)) return false
    if (weekUsed.has(ex.id) || dayUsed.has(ex.id)) return false
    if (!isExerciseSafeForPostures(ex, ids)) return false
    if (!extraSafe(ex)) return false
    return true
  })

  if (!pool.length) {
    // 本周已用过时，允许日内未用即可复用矫正动作
    const dayPool = exerciseCatalog.filter((ex) => {
      if (!correctiveExerciseIds.has(ex.id)) return false
      if (dayUsed.has(ex.id)) return false
      if (!isExerciseSafeForPostures(ex, ids)) return false
      if (!extraSafe(ex)) return false
      return true
    })
    if (!dayPool.length) return null
    return dayPool[dayIndex % dayPool.length]
  }

  return pool[dayIndex % pool.length]
}
