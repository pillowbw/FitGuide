import exercises from '../data/exercises.json'
import muscles from '../data/muscles.json'
import planRules from '../data/planRules.json'
import { getProfile, savePlan } from './storage'

function unique(ids) {
  return [...new Set(ids.filter(Boolean))]
}

function muscleName(id) {
  return muscles.find((m) => m.id === id)?.name || id
}

/**
 * 按路径筛选动作：业余优先 beginner；进阶优先 advanced，再补 beginner。
 */
function pickExercisesForMuscle(muscleId, path, limit, usedIds) {
  const matched = exercises.filter((ex) => ex.muscleIds.includes(muscleId))
  if (!matched.length) return []

  let pool
  if (path === 'beginner') {
    const easy = matched.filter((ex) => ex.level === 'beginner')
    pool = easy.length ? easy : matched
  } else {
    const hard = matched.filter((ex) => ex.level === 'advanced')
    pool = [...hard, ...matched.filter((ex) => ex.level !== 'advanced')]
  }

  const picked = []
  for (const ex of pool) {
    if (usedIds.has(ex.id)) continue
    picked.push(ex)
    usedIds.add(ex.id)
    if (picked.length >= limit) break
  }
  return picked
}

/**
 * 解析本周要练的肌肉列表。
 * 优先 selectedMuscleIds；否则按 goalRegion；再兜底全身。
 */
export function resolveMuscleIds(profile) {
  if (profile.selectedMuscleIds?.length) {
    return unique(profile.selectedMuscleIds)
  }

  const region = profile.goalRegion || 'full'
  const fromRegion =
    planRules.regionFocusOrder[region] || planRules.regionFocusOrder.full
  return [...fromRegion]
}

/**
 * 为一天选主次肌群：主肌 + 协同肌（pairHints），再回退列表轮转。
 */
function resolveDayMuscles(muscleIds, dayIndex, count) {
  const focusId = muscleIds[dayIndex % muscleIds.length]
  const chosen = [focusId]
  const pairs = planRules.pairHints[focusId] || []

  for (const pairId of pairs) {
    if (chosen.length >= count) break
    if (muscleIds.includes(pairId) && !chosen.includes(pairId)) {
      chosen.push(pairId)
    }
  }

  let offset = 1
  while (chosen.length < count && offset < muscleIds.length) {
    const next = muscleIds[(dayIndex + offset) % muscleIds.length]
    if (!chosen.includes(next)) chosen.push(next)
    offset += 1
  }

  return chosen
}

function buildPlanNote(profile) {
  const bodyNote =
    planRules.notesByBodyType[profile.currentBodyTypeId] ||
    '按自身感受调整重量，动作质量优先于重量。'
  const genderNote = planRules.notesByGender[profile.gender] || ''
  return [bodyNote, genderNote].filter(Boolean).join(' ')
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
  const daysCount = planRules.daysPerWeek[path]
  const musclesPerDay = planRules.musclesPerDay[path]
  const exercisesPerDay = planRules.exercisesPerDay[path]
  const muscleIds = resolveMuscleIds(profile)
  const setsLabel = planRules.defaultSets[path]
  const weekdayLabels =
    planRules.weekdayLabels[path] ||
    Array.from({ length: daysCount }, (_, i) => `第 ${i + 1} 天`)

  const days = []
  const weekUsedExerciseIds = new Set()

  for (let i = 0; i < daysCount; i += 1) {
    const dayMuscles = resolveDayMuscles(muscleIds, i, musclesPerDay)
    const dayUsed = new Set()
    const perMuscleLimit = Math.max(
      1,
      Math.ceil(exercisesPerDay / dayMuscles.length),
    )

    let dayExercises = dayMuscles.flatMap((id) =>
      pickExercisesForMuscle(id, path, perMuscleLimit, dayUsed).map((ex) => ({
        id: ex.id,
        name: ex.name,
        muscleIds: ex.muscleIds,
        level: ex.level,
        advice: ex.advice,
        videoUrl: ex.videoUrl,
        videoSource: ex.videoSource,
        setsLabel,
        primaryMuscleId: id,
        primaryMuscleName: muscleName(id),
      })),
    )

    if (dayExercises.length < exercisesPerDay) {
      const fillers = exercises.filter(
        (ex) =>
          !dayUsed.has(ex.id) &&
          !weekUsedExerciseIds.has(ex.id) &&
          ex.muscleIds.some((id) => muscleIds.includes(id)) &&
          (path !== 'beginner' || ex.level === 'beginner'),
      )
      for (const ex of fillers) {
        if (dayExercises.length >= exercisesPerDay) break
        dayUsed.add(ex.id)
        const primary =
          ex.muscleIds.find((id) => muscleIds.includes(id)) || ex.muscleIds[0]
        dayExercises.push({
          id: ex.id,
          name: ex.name,
          muscleIds: ex.muscleIds,
          level: ex.level,
          advice: ex.advice,
          videoUrl: ex.videoUrl,
          videoSource: ex.videoSource,
          setsLabel,
          primaryMuscleId: primary,
          primaryMuscleName: muscleName(primary),
        })
      }
    }

    dayExercises = dayExercises.slice(0, exercisesPerDay)
    dayExercises.forEach((ex) => weekUsedExerciseIds.add(ex.id))

    const focusId = dayMuscles[0]
    days.push({
      day: weekdayLabels[i] || `第 ${i + 1} 天`,
      dayIndex: i + 1,
      focus: muscleName(focusId),
      focusMuscleId: focusId,
      muscleIds: dayMuscles,
      muscleNames: dayMuscles.map(muscleName),
      exercises: dayExercises,
    })
  }

  return {
    weekLabel:
      path === 'beginner'
        ? `入门周计划（${daysCount} 练）`
        : `进阶周计划（${daysCount} 练）`,
    path,
    goalRegion: profile.goalRegion || 'full',
    sourceMuscleIds: muscleIds,
    generatedAt: new Date().toISOString(),
    note: buildPlanNote(profile),
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
