import bodyTypes from '../data/bodyTypes.json'
import exercises from '../data/exercises.json'
import muscles from '../data/muscles.json'
import planRules from '../data/planRules.json'
import { assessBodyLoad } from './bodyLoad'
import {
  adaptTemplateForInjuries,
  getExerciseInjuryCare,
  getInjuryVolumeSchemes,
  getRegionInjuryWarnings,
  injuryLabelsText,
  isExerciseSafeForInjuries,
  resolveInjuryConstraints,
} from './injurySafety'
import {
  getExercisePostureCare,
  getPostureCorrectiveSetsLabel,
  getRegionPostureHints,
  isExerciseSafeForPostures,
  pickCorrectiveExercise,
  postureLabelsText,
  resolvePostureConstraints,
} from './postureSafety'
import { sortPlanDaysChronologically } from './planOverview'
import { getPlan, getProfile, savePlan } from './storage'
import {
  extractYouTubeId,
  getVideoForExercise,
  youtubeThumbFromUrl,
} from './videoMap'

/** 计划结构版本：旧 localStorage 计划会自动按新规则重算 */
export const PLAN_VERSION = 12

const ALL_WEEKDAYS = [
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
  '周日',
]

/**
 * 按路径默认训练日，避开用户屏蔽的星期，并尽量拉开间隔。
 * @param {'beginner'|'advanced'} path
 * @param {string[]} [blockedWeekdays]
 * @param {number} [daysCount]
 */
export function resolveWeekdayLabels(path, blockedWeekdays = [], daysCount) {
  const count =
    daysCount ||
    planRules.daysPerWeek[path] ||
    planRules.daysPerWeek.beginner
  const blocked = new Set(
    (blockedWeekdays || []).filter((day) => ALL_WEEKDAYS.includes(day)),
  )
  const defaults = (
    planRules.weekdayLabels[path] ||
    planRules.weekdayLabels.beginner ||
    []
  ).filter((day) => !blocked.has(day))

  const picked = []

  for (const day of defaults) {
    if (picked.length >= count) break
    if (!picked.includes(day)) picked.push(day)
  }

  while (picked.length < count) {
    let best = null
    let bestScore = -Infinity

    for (const day of ALL_WEEKDAYS) {
      if (blocked.has(day) || picked.includes(day)) continue
      const index = ALL_WEEKDAYS.indexOf(day)
      const minDistance = picked.length
        ? Math.min(
            ...picked.map((item) =>
              Math.abs(ALL_WEEKDAYS.indexOf(item) - index),
            ),
          )
        : 3
      const score = minDistance * 10 - index
      if (score > bestScore) {
        bestScore = score
        best = day
      }
    }

    if (!best) break
    picked.push(best)
  }

  return picked
    .slice(0, count)
    .sort((a, b) => ALL_WEEKDAYS.indexOf(a) - ALL_WEEKDAYS.indexOf(b))
}

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
 * @param {import('./storage').UserProfile} profile
 */
export function resolvePhysiqueGoal(profile) {
  const id = profile?.targetBodyTypeId
  if (!id) return null
  const rules = planRules.physiqueGoals?.[id]
  if (!rules) return null
  const type = bodyTypes.find((item) => item.id === id && item.kind === 'target')
  return {
    id,
    label: type?.label || id,
    recommendedMuscleIds: type?.recommendedMuscleIds || [],
    recommendedRegions: type?.recommendedRegions || [],
    ...rules,
  }
}

/**
 * 解析本周目标肌群：优先 selectedMuscleIds / 目标体型推荐，否则按 goalRegion。
 * 有明确体型目标时只用协同肌补齐，避免把倒三角补成整片上肢池。
 */
export function resolveMuscleIds(profile) {
  const physique = resolvePhysiqueGoal(profile)
  const region = profile.goalRegion || ''

  let ids = profile.selectedMuscleIds?.length
    ? unique(profile.selectedMuscleIds)
    : []

  if (!ids.length && physique?.recommendedMuscleIds?.length) {
    ids = [...physique.recommendedMuscleIds]
    if (region && region !== 'full') {
      ids = ids.filter((id) => regionOfMuscle(id) === region)
    }
  }

  if (!ids.length) {
    ids = [
      ...(planRules.regionFocusOrder[region || 'full'] ||
        planRules.regionFocusOrder.full),
    ]
  }

  const maxMuscles = physique?.maxMuscles || 8
  const padMode = physique?.padMode || 'balanced'
  const minCount = padMode === 'strict' ? 3 : 4

  if (ids.length < minCount) {
    const extras = []
    for (const id of ids) {
      for (const pair of planRules.pairHints?.[id] || []) {
        if (region && region !== 'full' && regionOfMuscle(pair) !== region) {
          continue
        }
        extras.push(pair)
      }
    }

    // 无体型目标时，才用同部位肌群兜底，保证动作池够用
    if (padMode !== 'strict') {
      for (const id of ids) {
        const muscleRegion = regionOfMuscle(id)
        if (!muscleRegion) continue
        extras.push(
          ...muscles
            .filter((m) => m.region === muscleRegion)
            .map((m) => m.id),
        )
      }
    }

    ids = unique([...ids, ...extras]).slice(0, maxMuscles)
  } else if (physique) {
    ids = ids.slice(0, maxMuscles)
  }

  if (!ids.length) {
    ids = [...planRules.regionFocusOrder.full]
  }
  return ids
}

/**
 * 课表模板键：优先目标体型专属课表，再回落到部位 / 肌群推导。
 */
export function resolveTemplateRegion(profile, muscleIds) {
  const path = profile.path === 'advanced' ? 'advanced' : 'beginner'
  const pack =
    planRules.sessionTemplates[path] || planRules.sessionTemplates.beginner
  const physique = resolvePhysiqueGoal(profile)
  const goalRegion = profile.goalRegion || ''

  if (physique?.templateKey && pack[physique.templateKey]) {
    // 用户收窄到单一部位且与体型主战场不一致时，用部位课表，但仍保留肌群权重
    const primary = physique.preferRegion || ''
    const narrowed =
      goalRegion &&
      goalRegion !== 'full' &&
      primary &&
      goalRegion !== primary &&
      pack[goalRegion]
    if (!narrowed) {
      return physique.templateKey
    }
  }

  if (goalRegion && pack[goalRegion]) {
    return goalRegion
  }

  const regions = unique(muscleIds.map(regionOfMuscle).filter(Boolean))
  if (regions.length === 1 && pack[regions[0]]) return regions[0]
  if (regions.length === 0) return 'full'
  return pack.full ? 'full' : Object.keys(pack)[0] || 'full'
}

function getSessionTemplates(path, region) {
  const pack = planRules.sessionTemplates[path] || planRules.sessionTemplates.beginner
  return pack[region] || pack.full
}

/**
 * @param {string} schemeKey
 * @param {string} path
 * @param {import('./bodyLoad').BodyLoadAssessment} [load]
 * @param {{ lightLoad?: boolean }} [injuryOpts]
 */
function setsLabelFor(schemeKey, path, load, injuryOpts = {}) {
  if (injuryOpts.lightLoad) {
    const light = getInjuryVolumeSchemes()
    if (light?.[schemeKey]) return light[schemeKey]
    if (light?.beginner) return light.beginner
  }

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

/**
 * @param {object} ex
 * @param {object} slot
 * @param {string[]} targetMuscles
 * @param {string} path
 * @param {string[]} [preferredIds]
 * @param {{ muscleWeights?: Record<string, number>, genderBias?: Record<string, number> }} [focus]
 */
function scoreExercise(
  ex,
  slot,
  targetMuscles,
  path,
  preferredIds = [],
  focus = {},
) {
  let score = 0
  const weights = focus.muscleWeights || {}
  const genderBias = focus.genderBias || {}

  for (const id of ex.muscleIds) {
    if (!targetMuscles.includes(id)) continue
    const w = weights[id] || 1
    const g = genderBias[id] || 1
    score += 8 * w * g
  }

  if (slot.preferMuscles?.length) {
    for (const id of slot.preferMuscles) {
      if (!ex.muscleIds.includes(id)) continue
      const w = weights[id] || 1
      const g = genderBias[id] || 1
      score += 12 * w * g
    }
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

function buildExerciseFocus(profile) {
  const physique = resolvePhysiqueGoal(profile)
  if (!physique) return { muscleWeights: {}, genderBias: {} }
  const genderKey =
    profile.gender === 'female' || profile.gender === 'male'
      ? profile.gender
      : 'other'
  return {
    muscleWeights: physique.muscleWeights || {},
    genderBias: physique.genderBias?.[genderKey] || {},
  }
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
  focus = {},
) {
  if (!pool.length) return null
  const ranked = [...pool].sort(
    (a, b) =>
      scoreExercise(b, slot, targetMuscles, path, preferredIds, focus) -
      scoreExercise(a, slot, targetMuscles, path, preferredIds, focus),
  )
  const topScore = scoreExercise(
    ranked[0],
    slot,
    targetMuscles,
    path,
    preferredIds,
    focus,
  )
  const nearBest = ranked.filter(
    (ex) =>
      topScore -
        scoreExercise(ex, slot, targetMuscles, path, preferredIds, focus) <=
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
  injuryIds = [],
  focus = {},
  postureIds = [],
  dislikedIds = [],
) {
  const disliked = new Set(dislikedIds || [])
  const attempts = [
    { allowAdvancedFallback: false, relaxRole: false, relaxPattern: false },
    { allowAdvancedFallback: true, relaxRole: false, relaxPattern: false },
    { allowAdvancedFallback: true, relaxRole: true, relaxPattern: false },
    { allowAdvancedFallback: true, relaxRole: true, relaxPattern: true },
  ]

  for (const opts of attempts) {
    const pool = exercises.filter((ex) => {
      if (disliked.has(ex.id)) return false
      if (!isUnused(ex, weekUsed, dayUsed)) return false
      if (!isExerciseSafeForInjuries(ex, injuryIds)) return false
      if (!isExerciseSafeForPostures(ex, postureIds)) return false
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
      focus,
    )
    if (picked) return picked
  }

  return null
}

function toPlanExercise(
  ex,
  setsLabel,
  primaryMuscleId,
  injuryIds = [],
  postureIds = [],
) {
  const primary = primaryMuscleId || ex.muscleIds[0]
  const video = getVideoForExercise(ex.id, ex.name)
  const videoUrl = video?.url || ex.videoUrl
  const youtubeId = video?.youtubeId || extractYouTubeId(videoUrl)
  const care = getExerciseInjuryCare(ex, injuryIds)
  const postureCare = getExercisePostureCare(ex, postureIds)
  const careBadge = postureCare.related
    ? postureCare.careBadge
    : care.careBadge || ''
  const loadCue = postureCare.related
    ? postureCare.loadCue
    : care.loadCue || ''
  return {
    id: ex.id,
    name: ex.name,
    muscleIds: ex.muscleIds,
    level: ex.level,
    role: ex.role,
    pattern: ex.pattern,
    advice: ex.advice,
    videoUrl,
    videoSource: video ? 'youtube' : ex.videoSource,
    videoThumb: video?.thumb || youtubeThumbFromUrl(videoUrl),
    videoTitle: video?.title || null,
    youtubeId,
    setsLabel,
    primaryMuscleId: primary,
    primaryMuscleName: muscleName(primary),
    lightLoad: care.lightLoad,
    injuryRelated: care.related,
    loadCue,
    careBadge,
    injuryTip: care.tip || '',
    postureRelated: postureCare.related,
    postureTip: postureCare.tip || '',
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

function fillerScore(ex, targetMuscles, focus = {}) {
  const weights = focus.muscleWeights || {}
  const genderBias = focus.genderBias || {}
  let score = 0
  for (const id of ex.muscleIds) {
    if (!targetMuscles.includes(id)) continue
    score += (weights[id] || 1) * (genderBias[id] || 1)
  }
  return score
}

function fillDayFromTemplate(
  template,
  path,
  targetMuscles,
  weekUsed,
  dayIndex,
  load,
  preferredIds = [],
  injuryIds = [],
  focus = {},
  postureIds = [],
  dislikedIds = [],
) {
  const dayUsed = new Set()
  const picked = []
  const dayScheme = template.scheme
  const targetCount = exercisesPerDayFor(path, load)
  const disliked = new Set(dislikedIds || [])

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
      injuryIds,
      focus,
      postureIds,
      dislikedIds,
    )
    if (!ex) return

    dayUsed.add(ex.id)
    weekUsed.add(ex.id)

    const preferred =
      slot.preferMuscles?.find((id) => ex.muscleIds.includes(id)) ||
      ex.muscleIds.find((id) => targetMuscles.includes(id)) ||
      ex.muscleIds[0]
    const care = getExerciseInjuryCare(ex, injuryIds)
    const postureCare = getExercisePostureCare(ex, postureIds)
    const setsLabel = postureCare.related
      ? getPostureCorrectiveSetsLabel(slot.scheme || dayScheme) ||
        setsLabelFor(slot.scheme || dayScheme, path, load, {
          lightLoad: care.lightLoad,
        })
      : setsLabelFor(slot.scheme || dayScheme, path, load, {
          lightLoad: care.lightLoad,
        })

    picked.push(
      toPlanExercise(ex, setsLabel, preferred, injuryIds, postureIds),
    )
  })

  // 增肌：补到更高目标数量；控脂：不强行加孤立
  if (picked.length < targetCount) {
    const fillers = sortFillersForLoad(
      exercises.filter(
        (ex) =>
          !disliked.has(ex.id) &&
          isUnused(ex, weekUsed, dayUsed) &&
          isExerciseSafeForInjuries(ex, injuryIds) &&
          isExerciseSafeForPostures(ex, postureIds) &&
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
      if (bp !== ap) return bp - ap
      return (
        fillerScore(b, targetMuscles, focus) -
        fillerScore(a, targetMuscles, focus)
      )
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
      const care = getExerciseInjuryCare(ex, injuryIds)
      const postureCare = getExercisePostureCare(ex, postureIds)
      const setsLabel = postureCare.related
        ? getPostureCorrectiveSetsLabel(scheme) ||
          setsLabelFor(scheme, path, load, { lightLoad: care.lightLoad })
        : setsLabelFor(scheme, path, load, { lightLoad: care.lightLoad })
      picked.push(
        toPlanExercise(ex, setsLabel, primary, injuryIds, postureIds),
      )
    }
  }

  // 体态：每天尽量穿插 1 个矫正动作（若当日尚未命中）
  if (postureIds.length && !picked.some((ex) => ex.postureRelated)) {
    const corrective = pickCorrectiveExercise(
      exercises,
      postureIds,
      weekUsed,
      dayUsed,
      (ex) =>
        !disliked.has(ex.id) &&
        isExerciseSafeForInjuries(ex, injuryIds) &&
        levelAllowed(ex, path, { allowAdvancedFallback: true }),
      dayIndex,
    )
    if (corrective) {
      dayUsed.add(corrective.id)
      weekUsed.add(corrective.id)
      const scheme =
        corrective.pattern === 'core'
          ? 'core'
          : corrective.role === 'isolation'
            ? 'isolation'
            : 'isolation'
      const primary = corrective.muscleIds[0]
      const setsLabel =
        getPostureCorrectiveSetsLabel(scheme) ||
        setsLabelFor(scheme, path, load, { lightLoad: true })
      // 插在主项之后、孤立之前：约第 2～3 位
      const insertAt = Math.min(2, picked.length)
      picked.splice(
        insertAt,
        0,
        toPlanExercise(
          corrective,
          setsLabel,
          primary,
          injuryIds,
          postureIds,
        ),
      )
    }
  } else if (postureIds.length) {
    // 已自然命中矫正动作时，确保徽章与组数文案正确
    for (let i = 0; i < picked.length; i += 1) {
      const item = picked[i]
      if (!item.postureRelated) continue
      const scheme =
        item.pattern === 'core'
          ? 'core'
          : item.role === 'isolation'
            ? 'isolation'
            : dayScheme
      const correctiveLabel = getPostureCorrectiveSetsLabel(scheme)
      if (correctiveLabel) {
        picked[i] = { ...item, setsLabel: correctiveLabel }
      }
    }
  }

  return picked
}

function buildPlanNote(profile, load) {
  const bodyNote =
    planRules.notesByBodyType[profile.currentBodyTypeId] ||
    '按自身感受调整重量，动作质量优先于重量。'
  const targetNote =
    planRules.notesByTargetBodyType[profile.targetBodyTypeId] || ''
  const genderNote = planRules.notesByGender[profile.gender] || ''
  const loadNote = load?.summary || ''
  const injury = resolveInjuryConstraints(profile.injuries)
  const labels = injuryLabelsText(injury.injuryIds)
  const injuryNote = labels
    ? `已记录不适部位（${labels}）：相关动作会减重减次，并尽量换成更友好的模式；轻微弹响或紧绷常见，尖锐痛再停。`
    : ''
  const injuryDetail = injury.notes[0] || ''
  const posture = resolvePostureConstraints(profile.postures)
  const postureLabel = postureLabelsText(posture.postureIds)
  const postureNote = postureLabel
    ? `已记录体态问题（${postureLabel}）：训练中会穿插矫正动作并标注「改善体态」。`
    : ''
  const postureDetail = posture.notes[0] || ''
  return [
    loadNote,
    injuryNote,
    injuryDetail,
    postureNote,
    postureDetail,
    targetNote,
    bodyNote,
    genderNote,
  ]
    .filter(Boolean)
    .join(' ')
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

/**
 * 按当日动作主练肌群推荐练后拉伸部位（最多 4 处）。
 * @param {Array<{ primaryMuscleId?: string, muscleIds?: string[] }>} dayExercises
 * @param {string[]} focusMuscleIds
 */
export function buildDayStretches(dayExercises, focusMuscleIds = []) {
  const scores = new Map()

  for (const ex of dayExercises || []) {
    const primary = ex.primaryMuscleId || ex.muscleIds?.[0]
    if (primary) {
      scores.set(primary, (scores.get(primary) || 0) + 3)
    }
    for (const id of ex.muscleIds || []) {
      scores.set(id, (scores.get(id) || 0) + 1)
    }
  }

  for (const id of focusMuscleIds || []) {
    scores.set(id, (scores.get(id) || 0) + 1)
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id)

  const catalog = planRules.postWorkoutStretches || {}
  const stretches = []

  for (const id of ranked) {
    if (stretches.length >= 4) break
    const rule = catalog[id]
    const name = muscleName(id)
    if (!rule && !name) continue
    stretches.push({
      muscleId: id,
      muscleName: name,
      position: rule?.position || name,
      cue: rule?.cue || `${name}轻柔静态拉伸，紧而不痛即可`,
      holdSeconds: rule?.holdSeconds || 30,
      videoUrl: rule?.videoUrl || '',
    })
  }

  return stretches
}

/** 纯计算：根据档案生成计划对象，不写 localStorage */
export function buildPlan(profileInput) {
  const profile = profileInput || getProfile()
  const load = assessBodyLoad(profile)
  const path = profile.path === 'advanced' ? 'advanced' : 'beginner'
  const physique = resolvePhysiqueGoal(profile)
  const focus = buildExerciseFocus(profile)
  const muscleIds = resolveMuscleIds(profile)
  const injuryIds = unique(profile.injuries || [])
  const injuryConstraints = resolveInjuryConstraints(injuryIds)
  const postureIds = unique(profile.postures || [])
  const postureConstraints = resolvePostureConstraints(postureIds)
  const preferredIds = unique(profile.selectedExerciseIds || []).filter((id) => {
    const ex = exercises.find((item) => item.id === id)
    return ex
      ? isExerciseSafeForInjuries(ex, injuryIds) &&
          isExerciseSafeForPostures(ex, postureIds) &&
          !(profile.dislikedExerciseIds || []).includes(id)
      : false
  })
  const dislikedIds = unique(profile.dislikedExerciseIds || [])
  const region = resolveTemplateRegion(profile, muscleIds)
  const templates = getSessionTemplates(path, region).map((template) =>
    adaptTemplateForInjuries(template, injuryConstraints, region),
  )
  const daysCount = planRules.daysPerWeek[path]
  const perDay = exercisesPerDayFor(path, load)
  const weekdayLabels = resolveWeekdayLabels(
    path,
    profile.blockedWeekdays || [],
    daysCount,
  )
  const labels =
    weekdayLabels.length > 0
      ? weekdayLabels
      : Array.from({ length: daysCount }, (_, i) => `第 ${i + 1} 天`)

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
      injuryIds,
      focus,
      postureIds,
      dislikedIds,
    )

    const focusMuscles = unique(
      dayExercises.flatMap((ex) =>
        ex.muscleIds.filter((id) => muscleIds.includes(id)),
      ),
    )
    const stretches = buildDayStretches(dayExercises, focusMuscles)
    const postureInjected = dayExercises.some((ex) => ex.postureRelated)

    days.push({
      day: labels[i] || `第 ${i + 1} 天`,
      dayIndex: i + 1,
      sessionCode: template.code,
      sessionTitle: template.title,
      focus: postureInjected && postureConstraints.sessionFocus
        ? `${template.focus} · ${postureConstraints.sessionFocus}`
        : template.focus,
      focusMuscleId: focusMuscles[0] || muscleIds[0],
      muscleIds: focusMuscles,
      muscleNames: focusMuscles.map(muscleName),
      exercises: dayExercises,
      stretches,
      stretchNote: planRules.postWorkoutStretchNote || '',
      injuryAdapted: Boolean(template.injuryAdapted),
      postureAdapted: postureInjected,
    })
  }

  const uniqueExerciseCount = weekUsed.size
  const regionWarnings = getRegionInjuryWarnings(
    injuryIds,
    profile.goalRegion || region,
  )
  const postureHints = getRegionPostureHints(
    postureIds,
    profile.goalRegion || region,
  )
  const injuryLabel = injuryLabelsText(injuryIds)
  const postureLabel = postureLabelsText(postureIds)
  const weekSuffixParts = []
  if (injuryLabel) weekSuffixParts.push(`减量安排（${injuryLabel}）`)
  if (postureLabel) weekSuffixParts.push(`体态矫正（${postureLabel}）`)
  const weekSuffix = weekSuffixParts.length
    ? ` · ${weekSuffixParts.join(' · ')}`
    : ''
  const physiqueSuffix = physique?.label ? ` · ${physique.label}` : ''

  return {
    version: PLAN_VERSION,
    weekLabel:
      (path === 'beginner'
        ? `入门轮换 · ${load.goalLabel}（${daysCount} 练 · ${uniqueExerciseCount} 动作）`
        : `进阶分化 · ${load.goalLabel}（${daysCount} 练 · ${uniqueExerciseCount} 动作）`) +
      physiqueSuffix +
      weekSuffix,
    path,
    split: region,
    goalRegion: profile.goalRegion || region,
    targetBodyTypeId: profile.targetBodyTypeId || '',
    targetBodyTypeLabel: physique?.label || '',
    sourceMuscleIds: muscleIds,
    bodyLoad: {
      goal: load.goal,
      goalLabel: load.goalLabel,
      bmi: load.bmi,
      bodyFat: load.bodyFat,
      bodyTypeId: load.bodyTypeId,
      weightBand: load.weightBand,
      weightKg: load.weightKg,
      summary: load.summary,
      tips: load.tips,
      exercisesPerDay: perDay,
    },
    injuries: injuryIds,
    injuryCare: injuryIds.length
      ? {
          labels: injuryLabel,
          lightLoad: true,
          summary:
            '不适部位相关动作会减重减次；轻微弹响、紧绷常见，不等于马上受伤。只在尖锐痛、无力或不稳时停训。',
          warnings: regionWarnings.map((item) => item.warning),
          expected: regionWarnings
            .map((item) => item.expectedSensation)
            .filter(Boolean),
          tips: injuryConstraints.coachingTips,
          notes: injuryConstraints.notes,
        }
      : null,
    postures: postureIds,
    postureCare: postureIds.length
      ? {
          labels: postureLabel,
          summary:
            '已按体态问题在训练中穿插矫正动作，并标注「改善体态」。控速质量优先；有明显疼痛请先就医。',
          hints: postureHints.map((item) => item.hint),
          tips: postureConstraints.coachingTips,
          notes: postureConstraints.notes,
        }
      : null,
    generatedAt: new Date().toISOString(),
    profileFingerprint: '',
    note: buildPlanNote(profile, load),
    scienceNote: planRules.scienceNote,
    restDayHints: buildRestHints(profile, load),
    days: sortPlanDaysChronologically(days),
  }
}

/** 影响排课的档案字段指纹：一变就应重算计划 */
export function profileFingerprint(profileInput) {
  const p = profileInput || getProfile()
  const muscles = [...(p.selectedMuscleIds || [])].sort().join(',')
  const exerciseIds = [...(p.selectedExerciseIds || [])].sort().join(',')
  const blocked = [...(p.blockedWeekdays || [])].sort().join(',')
  const injuries = [...(p.injuries || [])].sort().join(',')
  const postures = [...(p.postures || [])].sort().join(',')
  return [
    p.gender || '',
    p.height ?? '',
    p.weight ?? '',
    p.waist ?? '',
    p.hip ?? '',
    p.bodyFat ?? '',
    p.currentBodyTypeId || '',
    p.path || '',
    p.goalRegion || '',
    p.targetBodyTypeId || '',
    muscles,
    exerciseIds,
    blocked,
    injuries,
    postures,
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
 * 为单个动作找同类替代（同 pattern / 肌群优先），避开已用与不喜欢的动作。
 * @param {object} fromEx 计划中的动作对象或库内动作
 * @param {object} plan
 * @param {import('./storage').UserProfile} profile
 * @param {string[]} [extraBlockedIds]
 */
export function findReplacementExercise(
  fromEx,
  plan,
  profile,
  extraBlockedIds = [],
) {
  if (!fromEx?.id) return null

  const path = profile?.path === 'advanced' ? 'advanced' : 'beginner'
  const injuryIds = unique(profile?.injuries || [])
  const postureIds = unique(profile?.postures || [])
  const disliked = new Set([
    ...(profile?.dislikedExerciseIds || []),
    ...extraBlockedIds,
    fromEx.id,
  ])
  const used = new Set(
    (plan?.days || []).flatMap((day) =>
      (day.exercises || []).map((ex) => ex.id).filter(Boolean),
    ),
  )
  used.add(fromEx.id)

  const source =
    exercises.find((item) => item.id === fromEx.id) || fromEx
  const targetMuscles = source.muscleIds || fromEx.muscleIds || []

  const scored = exercises
    .filter((ex) => {
      if (disliked.has(ex.id) || used.has(ex.id)) return false
      if (!isExerciseSafeForInjuries(ex, injuryIds)) return false
      if (!isExerciseSafeForPostures(ex, postureIds)) return false
      if (!levelAllowed(ex, path, { allowAdvancedFallback: true })) return false
      return true
    })
    .map((ex) => {
      let score = 0
      if (ex.pattern && ex.pattern === source.pattern) score += 40
      if (ex.role && ex.role === source.role) score += 12
      const overlap = (ex.muscleIds || []).filter((id) =>
        targetMuscles.includes(id),
      ).length
      score += overlap * 14
      if (path === 'beginner' && ex.level === 'beginner') score += 10
      if (path === 'beginner' && ex.level === 'advanced') score -= 6
      // 同名族（如反手引体）略降，优先真正不同的替代
      if (
        source.name &&
        ex.name &&
        (ex.name.includes(source.name.slice(0, 2)) ||
          source.name.includes(ex.name.slice(0, 2)))
      ) {
        score -= 4
      }
      return { ex, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.ex.name.localeCompare(b.ex.name, 'zh'))

  return scored[0]?.ex || null
}

/**
 * 把计划里不喜欢的动作原地换成替代动作，尽量保留其余课表。
 * @param {object} plan
 * @param {import('./storage').UserProfile} profile
 * @param {string[]} [targetIds] 只替换这些 id；默认替换 profile.dislikedExerciseIds
 * @returns {{ plan: object, replacements: Array<{ day: string, fromName: string, toName: string, fromId: string, toId: string }> }}
 */
export function replaceDislikedExercisesInPlan(
  plan,
  profile,
  targetIds = null,
) {
  if (!plan?.days?.length) {
    return { plan, replacements: [] }
  }

  const dislikeSet = new Set(
    targetIds?.length
      ? targetIds
      : profile?.dislikedExerciseIds || [],
  )
  if (dislikeSet.size === 0) {
    return { plan, replacements: [] }
  }

  const injuryIds = unique(profile?.injuries || [])
  const postureIds = unique(profile?.postures || [])
  const replacements = []
  let workingDays = plan.days.map((day) => ({
    ...day,
    exercises: [...(day.exercises || [])],
  }))

  for (let dayIndex = 0; dayIndex < workingDays.length; dayIndex += 1) {
    const day = workingDays[dayIndex]
    for (let exIndex = 0; exIndex < day.exercises.length; exIndex += 1) {
      const item = day.exercises[exIndex]
      if (!dislikeSet.has(item.id)) continue

      const workingPlan = { ...plan, days: workingDays }
      const replacement = findReplacementExercise(
        item,
        workingPlan,
        profile,
        [...dislikeSet],
      )
      if (!replacement) continue

      const next = toPlanExercise(
        replacement,
        item.setsLabel,
        item.primaryMuscleId ||
          replacement.muscleIds.find((id) =>
            (item.muscleIds || []).includes(id),
          ) ||
          replacement.muscleIds[0],
        injuryIds,
        postureIds,
      )

      day.exercises[exIndex] = next
      replacements.push({
        day: day.day || `第 ${day.dayIndex} 天`,
        fromName: item.name || item.id,
        toName: next.name,
        fromId: item.id,
        toId: next.id,
      })
    }
  }

  const nextPlan = {
    ...plan,
    days: workingDays,
    profileFingerprint: profileFingerprint(profile),
  }

  return { plan: nextPlan, replacements }
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
