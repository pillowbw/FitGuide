import injuryRules from '../data/injuryRules.json'

/** @returns {typeof injuryRules.options} */
export function getInjuryOptions() {
  return injuryRules.options || []
}

/**
 * @param {string[]|undefined|null} injuryIds
 * @returns {string[]}
 */
export function normalizeInjuryIds(injuryIds) {
  const allowed = new Set((injuryRules.options || []).map((item) => item.id))
  return [...new Set((injuryIds || []).filter((id) => allowed.has(id)))]
}

/**
 * @param {string} injuryId
 */
function getConstraint(injuryId) {
  return injuryRules.constraints?.[injuryId] || null
}

/**
 * 合并伤病约束。
 * @param {string[]|undefined|null} injuryIds
 */
export function resolveInjuryConstraints(injuryIds) {
  const ids = normalizeInjuryIds(injuryIds)
  const avoidPatterns = new Set()
  const avoidExerciseIds = new Set()
  const allowExerciseIds = new Set()
  const softCautionPatterns = new Set()
  const softCautionMuscles = new Set()
  const notes = []
  const coachingTips = []
  /** @type {object|null} */
  let slotFallback = null
  let sessionTitle = ''
  let sessionFocus = ''

  for (const id of ids) {
    const rule = getConstraint(id)
    if (!rule) continue
    for (const pattern of rule.avoidPatterns || []) avoidPatterns.add(pattern)
    for (const exerciseId of rule.avoidExerciseIds || []) {
      avoidExerciseIds.add(exerciseId)
    }
    for (const exerciseId of rule.allowExerciseIds || []) {
      allowExerciseIds.add(exerciseId)
    }
    for (const pattern of rule.softCautionPatterns || []) {
      softCautionPatterns.add(pattern)
    }
    for (const muscleId of rule.softCautionMuscles || []) {
      softCautionMuscles.add(muscleId)
    }
    if (rule.note) notes.push(rule.note)
    const tip = composeCoachingTip(rule)
    if (tip) coachingTips.push(tip)
    if (rule.slotFallback && !slotFallback) slotFallback = rule.slotFallback
    if (rule.sessionTitle && !sessionTitle) sessionTitle = rule.sessionTitle
    if (rule.sessionFocus && !sessionFocus) sessionFocus = rule.sessionFocus
  }

  return {
    injuryIds: ids,
    avoidPatterns,
    avoidExerciseIds,
    allowExerciseIds,
    softCautionPatterns,
    softCautionMuscles,
    notes: [...new Set(notes)],
    coachingTips: [...new Set(coachingTips)],
    /** @deprecated 兼容旧字段名 */
    cautionTips: [...new Set(coachingTips)],
    slotFallback,
    sessionTitle,
    sessionFocus,
    lightLoad: ids.length > 0,
  }
}

/**
 * @param {object} rule
 */
function composeCoachingTip(rule) {
  if (!rule) return ''
  return [rule.expectedSensation, rule.loadGuidance, rule.stopIf]
    .filter(Boolean)
    .join(' ')
}

/**
 * 找出与该动作最相关的伤病规则（用于写具体提示）。
 * @param {{ id: string, pattern?: string, muscleIds?: string[] }} exercise
 * @param {string[]} injuryIds
 */
function findRelatedInjuryRules(exercise, injuryIds) {
  const related = []
  for (const id of normalizeInjuryIds(injuryIds)) {
    const rule = getConstraint(id)
    if (!rule) continue
    const byAllow = (rule.allowExerciseIds || []).includes(exercise.id)
    const byPattern =
      Boolean(exercise.pattern) &&
      (rule.softCautionPatterns || []).includes(exercise.pattern)
    const byMuscle = (exercise.muscleIds || []).some((muscleId) =>
      (rule.softCautionMuscles || []).includes(muscleId),
    )
    if (byAllow || byPattern || byMuscle) {
      related.push({ id, rule })
    }
  }
  return related
}

/**
 * 某动作是否与已选伤病冲突（冲突则不应推荐）。
 * @param {{ id: string, pattern?: string }} exercise
 * @param {string[]|undefined|null} injuryIds
 */
export function isExerciseSafeForInjuries(exercise, injuryIds) {
  if (!exercise?.id) return false
  const {
    avoidPatterns,
    avoidExerciseIds,
    allowExerciseIds,
    injuryIds: ids,
  } = resolveInjuryConstraints(injuryIds)

  if (!ids.length) return true
  if (allowExerciseIds.has(exercise.id)) return true
  if (avoidExerciseIds.has(exercise.id)) return false
  if (exercise.pattern && avoidPatterns.has(exercise.pattern)) return false
  return true
}

/**
 * 是否属于「伤病相关动作」——只对这些动作减重减次并给说明。
 * @param {{ id: string, pattern?: string, muscleIds?: string[] }} exercise
 * @param {string[]|undefined|null} injuryIds
 */
export function needsInjuryCaution(exercise, injuryIds) {
  const ids = normalizeInjuryIds(injuryIds)
  if (!ids.length) return false
  if (!isExerciseSafeForInjuries(exercise, injuryIds)) return false
  return findRelatedInjuryRules(exercise, ids).length > 0
}

/**
 * @param {{ id: string, pattern?: string, muscleIds?: string[] }} exercise
 * @param {string[]|undefined|null} injuryIds
 */
export function getExerciseInjuryCare(exercise, injuryIds) {
  const ids = normalizeInjuryIds(injuryIds)
  if (!ids.length) {
    return {
      lightLoad: false,
      related: false,
      tip: '',
      loadCue: '',
      careBadge: '',
    }
  }

  const relatedRules = findRelatedInjuryRules(exercise, ids)
  if (!relatedRules.length) {
    return {
      lightLoad: false,
      related: false,
      tip: '',
      loadCue: '',
      careBadge: '',
    }
  }

  const primary = relatedRules[0].rule
  return {
    lightLoad: true,
    related: true,
    tip: composeCoachingTip(primary),
    loadCue: injuryRules.lightLoadCue || '减重减次',
    careBadge: primary.careBadge || '相关部位 · 减量',
  }
}

/**
 * @param {string[]|undefined|null} injuryIds
 * @param {string} [goalRegion]
 */
export function getRegionInjuryWarnings(injuryIds, goalRegion = '') {
  const ids = normalizeInjuryIds(injuryIds)
  if (!ids.length || !goalRegion) return []

  return (injuryRules.options || [])
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
        warning: option.regionWarning || option.hint,
        safeFocus: option.safeFocus || '',
        expectedSensation: rule?.expectedSensation || '',
        loadGuidance: rule?.loadGuidance || '',
        stopIf: rule?.stopIf || '',
      }
    })
}

/**
 * @param {string[]|undefined|null} injuryIds
 * @returns {string}
 */
export function injuryLabelsText(injuryIds) {
  const ids = normalizeInjuryIds(injuryIds)
  if (!ids.length) return ''
  const labelMap = new Map(
    (injuryRules.options || []).map((item) => [item.id, item.label]),
  )
  return ids.map((id) => labelMap.get(id) || id).join('、')
}

/** 伤病减量组数文案 */
export function getInjuryVolumeSchemes() {
  return injuryRules.volumeByInjury?.light || null
}

/**
 * @param {object} slot
 * @param {ReturnType<typeof resolveInjuryConstraints>} constraints
 */
export function adaptSlotForInjuries(slot, constraints) {
  if (!constraints.injuryIds.length) return slot

  const patterns = (slot.patterns || []).filter(
    (pattern) => !constraints.avoidPatterns.has(pattern),
  )

  if (patterns.length === (slot.patterns || []).length) {
    return slot
  }

  if (patterns.length > 0) {
    return { ...slot, patterns }
  }

  const fallback = constraints.slotFallback
  if (!fallback) return { ...slot, patterns: [] }

  return {
    ...slot,
    patterns: fallback.patterns || [],
    roles: fallback.roles || slot.roles,
    preferMuscles: fallback.preferMuscles || slot.preferMuscles,
  }
}

/**
 * @param {object} template
 * @param {ReturnType<typeof resolveInjuryConstraints>} constraints
 * @param {string} region
 */
export function adaptTemplateForInjuries(template, constraints, region) {
  if (!constraints.injuryIds.length) return template

  const originalSlots = template.slots || []
  const slots = originalSlots
    .map((slot) => adaptSlotForInjuries(slot, constraints))
    .filter(
      (slot) => (slot.patterns || []).length > 0 || slot.preferMuscles?.length,
    )

  const slotsChanged = originalSlots.some((slot) => {
    const next = adaptSlotForInjuries(slot, constraints)
    const before = (slot.patterns || []).join(',')
    const after = (next.patterns || []).join(',')
    return before !== after
  })

  const regionIsLower = region === 'lower'
  const regionIsUpper = region === 'upper'
  const lowerInjuries = constraints.injuryIds.some((id) =>
    ['knee', 'ankle', 'hip', 'lower_back'].includes(id),
  )
  const upperInjuries = constraints.injuryIds.some((id) =>
    ['shoulder', 'wrist', 'elbow', 'neck', 'lower_back'].includes(id),
  )

  const rewriteLower =
    lowerInjuries &&
    (regionIsLower || slotsChanged) &&
    Boolean(constraints.sessionTitle || constraints.sessionFocus)
  const rewriteUpper =
    upperInjuries &&
    (regionIsUpper || slotsChanged) &&
    Boolean(constraints.sessionTitle || constraints.sessionFocus)

  let title = template.title
  let focus = template.focus

  if (regionIsLower && lowerInjuries && constraints.sessionTitle) {
    title = `${constraints.sessionTitle}${template.code ? ` · ${template.code}` : ''}`
    focus = constraints.sessionFocus || focus
  } else if (regionIsUpper && upperInjuries && constraints.sessionTitle) {
    title = `${constraints.sessionTitle}${template.code ? ` · ${template.code}` : ''}`
    focus = constraints.sessionFocus || focus
  } else if (slotsChanged) {
    const tag = constraints.sessionTitle || '减量安排'
    title = `${template.title} · ${tag.replace(/·.*/, '').trim()}`
    focus = `${template.focus}（相关动作减重减次）`
  }

  return {
    ...template,
    title,
    focus,
    slots: slots.length ? slots : template.slots,
    injuryAdapted: slotsChanged || rewriteLower || rewriteUpper,
  }
}
