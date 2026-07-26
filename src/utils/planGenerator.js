import exercises from '../data/exercises.json'
import muscles from '../data/muscles.json'
import planRules from '../data/planRules.json'
import { assessBodyLoad } from './bodyLoad'
import { getPlan, getProfile, savePlan } from './storage'
import { getVideoForExercise } from './videoMap'

/** 计划结构版本：旧 localStorage 计划会自动按新规则重算 */
export const PLAN_VERSION = 5

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
 * 选得太少时，用协同肌补齐，避免一天只能排出两三个动作。
 */
export function resolveMuscleIds(profile) {
  let ids = profile.selectedMuscleIds?.length
    ? unique(profile.selectedMuscleIds)
    : [
        ...(planRules.regionFocusOrder[profile.goalRegion || 'full'] ||
          planRules.regionFocusOrder.full),
      ]

  // 少于 4 块时，按 pairHints / 同部位补齐，保证排课有足够动作池
  if (ids.length < 4) {
    const extras = []
    for (const id of ids) {
      for (const pair of planRules.pairHints?.[id] || []) {
        extras.push(pair)
      }
      const region = regionOfMuscle(id)
      if (region) {
        extras.push(
          ...muscles.filter((m) => m.region === region).map((m) => m.id),
        )
      }
    }
    ids = unique([...ids, ...extras]).slice(0, 8)
  }

  if (!ids.length) {
    ids = [...planRules.regionFocusOrder.full]
  }
  return ids
}

function resolveTemplateRegion(profile, muscleIds) {
  if (profile.goalRegion && planRules.sessionTemplates.beginner[profile.goalRegion]) {
    return profile.goalRegion
  }
  const regions = unique(muscleIds.map(regionOfMuscle).filter(Boolean))
  if (regions.length === 1) return regions[0]
  if (regions.length === 0) return 'full'
  return 'full'
}

function getSessionTemplates(path, region) {
  const pack = planRules.sessionTemplates[path] || planRules.sessionTemplates.beginner
  return pack[region] || pack.full
}

/**
 * @param {string} schemeKey
 * @param {string} path
 * @param {import('./bodyLoad').BodyLoadAssessment} [load]
 */
function setsLabelFor(schemeKey, path, load) {
  const byGoal = load?.volumeKey
    ? planRules.volumeByGoal?.[load.volumeKey]
    : null
  if (byGoal?.[schemeKey]) return byGoal[schemeKey]

  const schemes = planRules.setSchemes
  if (schemeKey && schemes[schemeKey]) return schemes[schemeKey]
  if (path === 'beginner') return schemes.beginner
  return schemes.hypertrophy
}

function exercisesPerDayFor(path, load) {
  const base = planRules.exercisesPerDay?.[path] || 5
  const fromGoal =
    planRules.volumeByGoal?.[load?.volumeKey]?.minExercisesPerDay?.[path]
  const target = fromGoal ?? base + (load?.exerciseDelta || 0)
  return Math.max(4, Math.min(7, target))
}

function levelAllowed(ex, path, { allowAdvancedFallback = false } = {}) {
  if (path !== 'beginner') return true
  if (ex.level === 'beginner') return true
  return allowAdvancedFallback
}

function scoreExercise(ex, slot, targetMuscles, path, preferredIds = []) {
  let score = 0
  const overlap = ex.muscleIds.filter((id) => targetMuscles.includes(id)).length
  score += overlap * 8

  if (slot.preferMuscles?.length) {
    score +=
      ex.muscleIds.filter((id) => slot.preferMuscles.includes(id)).length * 12
  }

  if (slot.roles?.length) {
    const roleIdx = slot.roles.indexOf(ex.role)
    if (roleIdx === 0) score += 14
    else if (roleIdx > 0) score += 6
    else score -= 2
  }

  if (slot.patterns?.includes(ex.pattern)) score += 6
  if (ex.role === 'compound') score += 4
  if (path === 'beginner' && ex.level === 'beginner') score += 10
  if (path === 'beginner' && ex.level === 'advanced') score -= 8
  if (path === 'advanced' && ex.level === 'advanced' && ex.role === 'compound') {
    score += 3
  }
  if (preferredIds.includes(ex.id)) score += 22

  return score
}

/**
 * 在尚未用过的候选里轮换，保证同一周尽量不出现相同动作。
 */
function pickRotated(
  pool,
  slot,
  targetMuscles,
  path,
  dayIndex,
  slotIndex,
  preferredIds = [],
) {
  if (!pool.length) return null
  const ranked = [...pool].sort(
    (a, b) =>
      scoreExercise(b, slot, targetMuscles, path, preferredIds) -
      scoreExercise(a, slot, targetMuscles, path, preferredIds),
  )
  const topScore = scoreExercise(
    ranked[0],
    slot,
    targetMuscles,
    path,
    preferredIds,
  )
  const nearBest = ranked.filter(
    (ex) =>
      topScore -
        scoreExercise(ex, slot, targetMuscles, path, preferredIds) <=
      16,
  )
  const window = nearBest.slice(0, Math.min(6, nearBest.length))
  return window[(dayIndex * 3 + slotIndex * 2) % window.length]
}

function isUnused(ex, weekUsed, dayUsed) {
  return !weekUsed.has(ex.id) && !dayUsed.has(ex.id)
}

/**
 * 逐级放宽约束，但始终禁止本周已用过的动作。
 */
function pickForSlot(
  slot,
  path,
  targetMuscles,
  weekUsed,
  dayUsed,
  dayIndex,
  slotIndex,
  preferredIds = [],
) {
  const attempts = [
    { allowAdvancedFallback: false, relaxRole: false, relaxPattern: false },
    { allowAdvancedFallback: true, relaxRole: false, relaxPattern: false },
    { allowAdvancedFallback: true, relaxRole: true, relaxPattern: false },
    { allowAdvancedFallback: true, relaxRole: true, relaxPattern: true },
  ]

  for (const opts of attempts) {
    const pool = exercises.filter((ex) => {
      if (!isUnused(ex, weekUsed, dayUsed)) return false
      if (!levelAllowed(ex, path, opts)) return false

      if (!opts.relaxPattern && slot.patterns?.length) {
        if (!slot.patterns.includes(ex.pattern)) return false
      }

      if (!opts.relaxRole && slot.roles?.length) {
        if (!slot.roles.includes(ex.role) && !slot.preferMuscles?.length) {
          return false
        }
      }

      const hitsTarget = ex.muscleIds.some((id) => targetMuscles.includes(id))
      const hitsPrefer = slot.preferMuscles?.some((id) =>
        ex.muscleIds.includes(id),
      )
      const isSupport = ex.pattern === 'core' || ex.pattern === 'carry'
      if (!hitsTarget && !hitsPrefer && !isSupport && !opts.relaxPattern) {
        return false
      }

      // 最宽一层：只要未用过且等级允许即可
      if (opts.relaxPattern) {
        return (
          hitsTarget ||
          hitsPrefer ||
          isSupport ||
          slot.patterns?.includes(ex.pattern)
        )
      }

      return true
    })

    const picked = pickRotated(
      pool,
      slot,
      targetMuscles,
      path,
      dayIndex,
      slotIndex,
      preferredIds,
    )
    if (picked) return picked
  }

  return null
}

function toPlanExercise(ex, setsLabel, primaryMuscleId) {
  const primary = primaryMuscleId || ex.muscleIds[0]
  const video = getVideoForExercise(ex.id, ex.name)
  return {
    id: ex.id,
    name: ex.name,
    muscleIds: ex.muscleIds,
    level: ex.level,
    role: ex.role,
    pattern: ex.pattern,
    advice: ex.advice,
    videoUrl: video?.url || ex.videoUrl,
    videoSource: video ? 'youtube' : ex.videoSource,
    videoThumb: video?.thumb || null,
    videoTitle: video?.title || null,
    youtubeId: video?.youtubeId || null,
    setsLabel,
    primaryMuscleId: primary,
    primaryMuscleName: muscleName(primary),
  }
}

/**
 * 控脂倾向：复合动作优先；增肌倾向：保留孤立细节。
 */
function sortFillersForLoad(list, targetMuscles, load, dayIndex) {
  return [...list].sort((a, b) => {
    if (load?.goal === 'cut') {
      const roleScore = (ex) =>
        ex.role === 'compound' ? 3 : ex.role === 'accessory' ? 2 : 1
      const diff = roleScore(b) - roleScore(a)
      if (diff) return diff
    }
    if (load?.goal === 'build') {
      const roleScore = (ex) =>
        ex.role === 'compound' ? 3 : ex.role === 'isolation' ? 2 : 1
      const diff = roleScore(b) - roleScore(a)
      if (diff) return diff
    }
    const ao = a.muscleIds.filter((id) => targetMuscles.includes(id)).length
    const bo = b.muscleIds.filter((id) => targetMuscles.includes(id)).length
    if (bo !== ao) return bo - ao
    return (
      (a.id.charCodeAt(0) + dayIndex) % 9 - (b.id.charCodeAt(0) + dayIndex) % 9
    )
  })
}

function fillDayFromTemplate(
  template,
  path,
  targetMuscles,
  weekUsed,
  dayIndex,
  load,
  preferredIds = [],
) {
  const dayUsed = new Set()
  const picked = []
  const dayScheme = template.scheme
  const targetCount = exercisesPerDayFor(path, load)

  // 控脂：略减孤立槽位，优先用模板前几项（多为主项复合）
  const slots =
    load?.goal === 'cut' && template.slots.length > targetCount
      ? template.slots.slice(0, targetCount)
      : template.slots

  slots.forEach((slot, slotIndex) => {
    const ex = pickForSlot(
      slot,
      path,
      targetMuscles,
      weekUsed,
      dayUsed,
      dayIndex,
      slotIndex,
      preferredIds,
    )
    if (!ex) return

    dayUsed.add(ex.id)
    weekUsed.add(ex.id)

    const preferred =
      slot.preferMuscles?.find((id) => ex.muscleIds.includes(id)) ||
      ex.muscleIds.find((id) => targetMuscles.includes(id)) ||
      ex.muscleIds[0]

    picked.push(
      toPlanExercise(
        ex,
        setsLabelFor(slot.scheme || dayScheme, path, load),
        preferred,
      ),
    )
  })

  // 增肌：补到更高目标数量；控脂：不强行加孤立
  if (picked.length < targetCount) {
    const fillers = sortFillersForLoad(
      exercises.filter(
        (ex) =>
          isUnused(ex, weekUsed, dayUsed) &&
          levelAllowed(ex, path, {
            allowAdvancedFallback: path === 'beginner',
          }) &&
          (ex.muscleIds.some((id) => targetMuscles.includes(id)) ||
            preferredIds.includes(ex.id) ||
            ex.pattern === 'core' ||
            ex.pattern === 'carry'),
      ),
      targetMuscles,
      load,
      dayIndex,
    ).sort((a, b) => {
      const ap = preferredIds.includes(a.id) ? 1 : 0
      const bp = preferredIds.includes(b.id) ? 1 : 0
      return bp - ap
    })

    for (const ex of fillers) {
      if (picked.length >= targetCount) break
      dayUsed.add(ex.id)
      weekUsed.add(ex.id)
      const primary =
        ex.muscleIds.find((id) => targetMuscles.includes(id)) || ex.muscleIds[0]
      const scheme =
        ex.pattern === 'core'
          ? 'core'
          : ex.role === 'isolation'
            ? 'isolation'
            : dayScheme
      picked.push(
        toPlanExercise(ex, setsLabelFor(scheme, path, load), primary),
      )
    }
  }

  return picked
}

function buildPlanNote(profile, load) {
  const bodyNote =
    planRules.notesByBodyType[profile.currentBodyTypeId] ||
    '按自身感受调整重量，动作质量优先于重量。'
  const genderNote = planRules.notesByGender[profile.gender] || ''
  const loadNote = load?.summary || ''
  return [loadNote, bodyNote, genderNote].filter(Boolean).join(' ')
}

function buildRestHints(profile, load) {
  const hints = [...planRules.restDayHints]
  const cardio = planRules.cardioHintsByBodyType[profile.currentBodyTypeId]
  if (cardio) hints.push(cardio)
  if (load?.tips?.length) {
    hints.push(...load.tips.slice(0, 2))
  }
  return unique(hints)
}

/** 纯计算：根据档案生成计划对象，不写 localStorage */
export function buildPlan(profileInput) {
  const profile = profileInput || getProfile()
  const load = assessBodyLoad(profile)
  const path = profile.path === 'advanced' ? 'advanced' : 'beginner'
  const muscleIds = resolveMuscleIds(profile)
  const preferredIds = unique(profile.selectedExerciseIds || [])
  const region = resolveTemplateRegion(profile, muscleIds)
  const templates = getSessionTemplates(path, region)
  const daysCount = planRules.daysPerWeek[path]
  const perDay = exercisesPerDayFor(path, load)
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
      i,
      load,
      preferredIds,
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
    version: PLAN_VERSION,
    weekLabel:
      path === 'beginner'
        ? `入门轮换 · ${load.goalLabel}（${daysCount} 练 · ${uniqueExerciseCount} 动作）`
        : `进阶分化 · ${load.goalLabel}（${daysCount} 练 · ${uniqueExerciseCount} 动作）`,
    path,
    split: region,
    goalRegion: profile.goalRegion || region,
    sourceMuscleIds: muscleIds,
    bodyLoad: {
      goal: load.goal,
      goalLabel: load.goalLabel,
      bmi: load.bmi,
      bodyFat: load.bodyFat,
      bodyTypeId: load.bodyTypeId,
      summary: load.summary,
      tips: load.tips,
      exercisesPerDay: perDay,
    },
    generatedAt: new Date().toISOString(),
    profileFingerprint: '',
    note: buildPlanNote(profile, load),
    scienceNote: planRules.scienceNote,
    restDayHints: buildRestHints(profile, load),
    days,
  }
}

/** 影响排课的档案字段指纹：一变就应重算计划 */
export function profileFingerprint(profileInput) {
  const p = profileInput || getProfile()
  const muscles = [...(p.selectedMuscleIds || [])].sort().join(',')
  const exerciseIds = [...(p.selectedExerciseIds || [])].sort().join(',')
  return [
    p.gender || '',
    p.height ?? '',
    p.weight ?? '',
    p.bodyFat ?? '',
    p.currentBodyTypeId || '',
    p.path || '',
    p.goalRegion || '',
    p.targetBodyTypeId || '',
    muscles,
    exerciseIds,
  ].join('|')
}

/** 旧版 localStorage 计划（无 version / sessionCode）需要刷新 */
export function isStalePlan(plan, profileInput) {
  if (!plan?.days?.length) return true
  if (plan.version !== PLAN_VERSION) return true
  if (plan.days.some((d) => !d.sessionCode)) return true
  if (!plan.bodyLoad?.goal) return true
  const fp = profileFingerprint(profileInput)
  if (plan.profileFingerprint && plan.profileFingerprint !== fp) return true
  if (!plan.profileFingerprint) return true
  return false
}

/**
 * 根据用户档案生成一周训练计划，并写入 localStorage。
 * @param {import('./storage').UserProfile} [profileOverride]
 * @param {{ reuseWeekId?: string }} [options] 档案微调时复用周 id，保留勾选进度
 */
export function generatePlan(profileOverride, options = {}) {
  const profile = profileOverride || getProfile()
  const plan = buildPlan(profile)
  plan.profileFingerprint = profileFingerprint(profile)
  if (options.reuseWeekId) {
    plan.generatedAt = options.reuseWeekId
  }
  savePlan(plan)
  return plan
}

/**
 * 档案变更后同步计划：已有计划则按新档案重算（不归档历史周）。
 * @param {import('./storage').UserProfile} [profileOverride]
 * @returns {object|null}
 */
export function syncPlanWithProfile(profileOverride) {
  const profile = profileOverride || getProfile()
  const existing = getPlan()
  if (!existing) return null

  if (!isStalePlan(existing, profile)) {
    return existing
  }

  return generatePlan(profile, { reuseWeekId: existing.generatedAt })
}
