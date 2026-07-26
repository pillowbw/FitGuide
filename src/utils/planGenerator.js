import exercises from '../data/exercises.json'
import muscles from '../data/muscles.json'
import planRules from '../data/planRules.json'
import { getProfile, savePlan } from './storage'

function unique(ids) {
  return [...new Set((ids || []).filter(Boolean))]
}

function muscleName(id) {
  return muscles.find((m) => m.id === id)?.name || id
}

function regionOfMuscle(id) {
  return muscles.find((m) => m.id === id)?.region || ''
}

/**
 * 解析本周目标肌群：优先 selectedMuscleIds，否则按 goalRegion。
 */
export function resolveMuscleIds(profile) {
  if (profile.selectedMuscleIds?.length) {
    return unique(profile.selectedMuscleIds)
  }
  const region = profile.goalRegion || 'full'
  return [...(planRules.regionFocusOrder[region] || planRules.regionFocusOrder.full)]
}

/**
 * 根据档案推断课表分区：full / upper / lower / core
 */
function resolveTemplateRegion(profile, muscleIds) {
  if (profile.goalRegion && planRules.sessionTemplates.beginner[profile.goalRegion]) {
    return profile.goalRegion
  }

  const regions = unique(muscleIds.map(regionOfMuscle).filter(Boolean))
  if (regions.length === 1) return regions[0]
  if (regions.length === 0) return 'full'
  // 多部位或上下都有 → 全身/上下分化模板
  return 'full'
}

function getSessionTemplates(path, region) {
  const pack = planRules.sessionTemplates[path] || planRules.sessionTemplates.beginner
  return pack[region] || pack.full
}

function setsLabelFor(schemeKey, path) {
  const schemes = planRules.setSchemes
  if (schemeKey && schemes[schemeKey]) return schemes[schemeKey]
  if (path === 'beginner') return schemes.beginner
  return schemes.hypertrophy
}

function levelAllowed(ex, path) {
  if (path === 'beginner') return ex.level === 'beginner'
  return true
}

/**
 * 给候选动作打分：越贴合目标肌群、越符合 slot、本周未用过分越高。
 */
function scoreExercise(ex, slot, targetMuscles, weekUsed, path) {
  let score = 0
  const overlap = ex.muscleIds.filter((id) => targetMuscles.includes(id)).length
  score += overlap * 8

  if (slot.preferMuscles?.length) {
    const preferHit = ex.muscleIds.filter((id) =>
      slot.preferMuscles.includes(id),
    ).length
    score += preferHit * 12
  }

  if (slot.roles?.length) {
    const roleIdx = slot.roles.indexOf(ex.role)
    if (roleIdx === 0) score += 14
    else if (roleIdx > 0) score += 6
    else score -= 2
  }

  if (slot.patterns?.includes(ex.pattern)) score += 6

  // 主项槽位优先真正的复合动作
  if (ex.role === 'compound') score += 4

  // 进阶略偏好 advanced 复合动作做主项
  if (path === 'advanced' && ex.level === 'advanced' && ex.role === 'compound') {
    score += 3
  }

  // 强烈避免本周重复
  if (weekUsed.has(ex.id)) score -= 100

  // 轻微偏好尚未用过的模式组合多样性已由模板保证
  return score
}

function matchesSlot(ex, slot, path) {
  if (!levelAllowed(ex, path)) return false
  if (slot.patterns?.length && !slot.patterns.includes(ex.pattern)) return false
  if (slot.roles?.length && !slot.roles.includes(ex.role)) {
    // roles 为软约束：isolation slot 若写了 roles 则严格；否则上面已用 patterns
    // 若同时有 preferMuscles，允许 role 不完全匹配
    if (!slot.preferMuscles?.length) return false
  }
  return true
}

function pickForSlot(slot, path, targetMuscles, weekUsed, dayUsed) {
  const candidates = exercises.filter(
    (ex) =>
      matchesSlot(ex, slot, path) &&
      !dayUsed.has(ex.id) &&
      // 至少与目标肌群有关，或是 core/carry 这类通用支持项
      (ex.muscleIds.some((id) => targetMuscles.includes(id)) ||
        ex.pattern === 'core' ||
        ex.pattern === 'carry' ||
        slot.preferMuscles?.some((id) => ex.muscleIds.includes(id))),
  )

  if (!candidates.length) {
    // 放宽：忽略 role，只看 pattern + 未使用
    const loose = exercises.filter(
      (ex) =>
        levelAllowed(ex, path) &&
        !dayUsed.has(ex.id) &&
        !weekUsed.has(ex.id) &&
        (!slot.patterns?.length || slot.patterns.includes(ex.pattern)),
    )
    if (!loose.length) return null
    loose.sort(
      (a, b) =>
        scoreExercise(b, slot, targetMuscles, weekUsed, path) -
        scoreExercise(a, slot, targetMuscles, weekUsed, path),
    )
    return loose[0]
  }

  // 先尽量选本周没用过的
  const fresh = candidates.filter((ex) => !weekUsed.has(ex.id))
  const pool = fresh.length ? fresh : candidates

  pool.sort(
    (a, b) =>
      scoreExercise(b, slot, targetMuscles, weekUsed, path) -
      scoreExercise(a, slot, targetMuscles, weekUsed, path),
  )
  return pool[0]
}

function toPlanExercise(ex, setsLabel, primaryMuscleId) {
  const primary =
    primaryMuscleId ||
    ex.muscleIds[0]
  return {
    id: ex.id,
    name: ex.name,
    muscleIds: ex.muscleIds,
    level: ex.level,
    role: ex.role,
    pattern: ex.pattern,
    advice: ex.advice,
    videoUrl: ex.videoUrl,
    videoSource: ex.videoSource,
    setsLabel,
    primaryMuscleId: primary,
    primaryMuscleName: muscleName(primary),
  }
}

function fillDayFromTemplate(template, path, targetMuscles, weekUsed) {
  const dayUsed = new Set()
  const picked = []
  const dayScheme = template.scheme

  for (const slot of template.slots) {
    const ex = pickForSlot(slot, path, targetMuscles, weekUsed, dayUsed)
    if (!ex) continue
    dayUsed.add(ex.id)
    weekUsed.add(ex.id)

    const label = setsLabelFor(slot.scheme || dayScheme, path)
    const preferred =
      slot.preferMuscles?.find((id) => ex.muscleIds.includes(id)) ||
      ex.muscleIds.find((id) => targetMuscles.includes(id)) ||
      ex.muscleIds[0]

    picked.push(toPlanExercise(ex, label, preferred))
  }

  // 当天动作偏少时，用尚未用过、且命中目标肌群的动作补齐
  const minCount = template.slots.length
  if (picked.length < minCount) {
    const fillers = exercises
      .filter(
        (ex) =>
          levelAllowed(ex, path) &&
          !dayUsed.has(ex.id) &&
          !weekUsed.has(ex.id) &&
          ex.muscleIds.some((id) => targetMuscles.includes(id)),
      )
      .sort((a, b) => {
        const ao = a.muscleIds.filter((id) => targetMuscles.includes(id)).length
        const bo = b.muscleIds.filter((id) => targetMuscles.includes(id)).length
        return bo - ao
      })

    for (const ex of fillers) {
      if (picked.length >= minCount) break
      dayUsed.add(ex.id)
      weekUsed.add(ex.id)
      const primary =
        ex.muscleIds.find((id) => targetMuscles.includes(id)) || ex.muscleIds[0]
      picked.push(toPlanExercise(ex, setsLabelFor(dayScheme, path), primary))
    }
  }

  return picked
}

function buildPlanNote(profile) {
  const bodyNote =
    planRules.notesByBodyType[profile.currentBodyTypeId] ||
    '按自身感受调整重量，动作质量优先于重量。'
  const genderNote = planRules.notesByGender[profile.gender] || ''
  return [planRules.scienceNote, bodyNote, genderNote].filter(Boolean).join(' ')
}

function buildRestHints(profile) {
  const hints = [...planRules.restDayHints]
  const cardio = planRules.cardioHintsByBodyType[profile.currentBodyTypeId]
  if (cardio) hints.push(cardio)
  return hints
}

/** 纯计算：根据档案生成计划对象，不写 localStorage */
export function buildPlan(profileInput) {
  const profile = profileInput || getProfile()
  const path = profile.path === 'advanced' ? 'advanced' : 'beginner'
  const muscleIds = resolveMuscleIds(profile)
  const region = resolveTemplateRegion(profile, muscleIds)
  const templates = getSessionTemplates(path, region)
  const daysCount = planRules.daysPerWeek[path]
  const weekdayLabels =
    planRules.weekdayLabels[path] ||
    Array.from({ length: daysCount }, (_, i) => `第 ${i + 1} 天`)

  const weekUsed = new Set()
  const days = []

  for (let i = 0; i < daysCount; i += 1) {
    const template = templates[i % templates.length]
    const dayExercises = fillDayFromTemplate(
      template,
      path,
      muscleIds,
      weekUsed,
    )

    const focusMuscles = unique(
      dayExercises.flatMap((ex) =>
        ex.muscleIds.filter((id) => muscleIds.includes(id)),
      ),
    )

    days.push({
      day: weekdayLabels[i] || `第 ${i + 1} 天`,
      dayIndex: i + 1,
      sessionCode: template.code,
      sessionTitle: template.title,
      focus: template.focus,
      focusMuscleId: focusMuscles[0] || muscleIds[0],
      muscleIds: focusMuscles,
      muscleNames: focusMuscles.map(muscleName),
      exercises: dayExercises,
    })
  }

  const uniqueExerciseCount = weekUsed.size

  return {
    weekLabel:
      path === 'beginner'
        ? `入门全身轮换（${daysCount} 练 · ${uniqueExerciseCount} 个动作）`
        : `进阶上下分化（${daysCount} 练 · ${uniqueExerciseCount} 个动作）`,
    path,
    split: region,
    goalRegion: profile.goalRegion || region,
    sourceMuscleIds: muscleIds,
    generatedAt: new Date().toISOString(),
    note: buildPlanNote(profile),
    scienceNote: planRules.scienceNote,
    restDayHints: buildRestHints(profile),
    days,
  }
}

/**
 * 根据用户档案生成一周训练计划，并写入 localStorage。
 * @param {import('./storage').UserProfile} [profileOverride]
 */
export function generatePlan(profileOverride) {
  const plan = buildPlan(profileOverride || getProfile())
  savePlan(plan)
  return plan
}
