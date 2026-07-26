import foods from '../data/foodEquivalents.json'

const ROLE_MET = {
  compound: 6.0,
  accessory: 5.0,
  isolation: 4.0,
}

/** 含组间休息；新手组间往往更长 */
const ROLE_MIN_PER_SET = {
  compound: 2.8,
  accessory: 2.2,
  isolation: 2.0,
}

const DEFAULT_WEIGHT_KG = 65
const WARMUP_MINUTES = 6

/** 新手更熟的「一顿菜」优先作对照 */
const PRIORITY_FOOD_IDS = new Set([
  'fried_chicken',
  'malatang',
  'milk_tea',
  'burger',
  'dumpling',
  'rice_bowl',
  'cola',
])

/** 从「3 组 × 10–12 次」解析组数 */
export function parseSetsCount(setsLabel) {
  if (!setsLabel || typeof setsLabel !== 'string') return 3
  const match = setsLabel.match(/(\d+)\s*组/)
  if (!match) return 3
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : 3
}

/**
 * 估算单日力量课消耗（MET × 体重 × 小时）
 * @param {{ exercises?: Array<{ role?: string, setsLabel?: string }> }} day
 * @param {number|null|undefined} weightKg
 */
export function estimateDayBurn(day, weightKg) {
  const weight =
    typeof weightKg === 'number' && weightKg > 0 ? weightKg : DEFAULT_WEIGHT_KG
  const exercises = day?.exercises || []

  let minutes = WARMUP_MINUTES
  let metMinutes = 0

  for (const ex of exercises) {
    const role = ROLE_MET[ex.role] ? ex.role : 'accessory'
    const sets = parseSetsCount(ex.setsLabel)
    const exMin = ROLE_MIN_PER_SET[role] * sets
    minutes += exMin
    metMinutes += ROLE_MET[role] * exMin
  }

  if (exercises.length === 0) {
    return { kcal: 0, minutes: 0, usedDefaultWeight: weight === DEFAULT_WEIGHT_KG }
  }

  const avgMet = metMinutes / minutes
  const kcal = Math.round(weight * avgMet * (minutes / 60))

  return {
    kcal: Math.max(kcal, 40),
    minutes: Math.round(minutes),
    usedDefaultWeight: !(typeof weightKg === 'number' && weightKg > 0),
  }
}

/** 把消耗量说成「半份 / 大半份 / 一份…」 */
export function formatFoodPortion(kcal, food) {
  const ratio = kcal / food.kcal
  const label = food.shortName || food.name
  if (ratio < 0.3) return `小半份${label}`
  if (ratio < 0.55) return `半份${label}`
  if (ratio < 0.8) return `大半份${label}`
  if (ratio < 1.15) return `一份${label}`
  if (ratio < 1.55) return `一份半${label}`
  if (ratio < 2.2) return `两份${label}`
  return `约 ${Math.round(ratio * 10) / 10} 份${label}`
}

/**
 * 挑 1–2 个好理解的食物对照（优先炸鸡 / 麻辣烫等）
 * @param {number} kcal
 * @param {number} [count=2]
 */
export function pickFoodEquivalents(kcal, count = 2) {
  if (!kcal || kcal <= 0) return []

  const scored = foods.map((food) => {
    const ratio = kcal / food.kcal
    // 份量越接近「半份～一份」，越好读
    const distance = Math.min(
      Math.abs(ratio - 0.5),
      Math.abs(ratio - 0.75),
      Math.abs(ratio - 1),
    )
    const priorityBoost = PRIORITY_FOOD_IDS.has(food.id) ? -0.12 : 0
    // 单日消耗较小时，过大一顿（火锅等）只显示「小半份」不够直观，略降权
    const tooBigPenalty = ratio < 0.28 ? 0.25 : 0
    return { food, ratio, score: distance + priorityBoost + tooBigPenalty }
  })

  scored.sort((a, b) => a.score - b.score)

  const picked = []
  for (const item of scored) {
    if (picked.length >= count) break
    if (picked.some((p) => Math.abs(p.food.kcal - item.food.kcal) < 80)) continue
    picked.push(item)
  }

  return picked.map(({ food }) => ({
    id: food.id,
    name: food.name,
    shortName: food.shortName,
    kcal: food.kcal,
    label: formatFoodPortion(kcal, food),
  }))
}

/**
 * 单日：消耗 + 食物对照文案
 * @param {{ exercises?: Array }} day
 * @param {number|null|undefined} weightKg
 */
export function describeDayBurn(day, weightKg) {
  const burn = estimateDayBurn(day, weightKg)
  const foodsEq = pickFoodEquivalents(burn.kcal, 2)
  return {
    ...burn,
    foods: foodsEq,
    foodLine: joinFoodLabels(foodsEq),
  }
}

/** 多种对照是「或」关系，不是热量相加 */
function joinFoodLabels(foodsEq) {
  const labels = foodsEq.map((f) => f.label)
  if (labels.length <= 1) return labels[0] || ''
  if (labels.length === 2) return `${labels[0]}，或 ${labels[1]}`
  return `${labels.slice(0, -1).join('、')}，或 ${labels[labels.length - 1]}`
}

/**
 * 整周合计
 * @param {{ days?: Array }} plan
 * @param {number|null|undefined} weightKg
 */
export function describeWeekBurn(plan, weightKg) {
  const days = plan?.days || []
  let totalKcal = 0
  let usedDefaultWeight = false

  for (const day of days) {
    const burn = estimateDayBurn(day, weightKg)
    totalKcal += burn.kcal
    if (burn.usedDefaultWeight) usedDefaultWeight = true
  }

  const foodsEq = pickFoodEquivalents(totalKcal, 2)
  return {
    kcal: totalKcal,
    usedDefaultWeight,
    foods: foodsEq,
    foodLine: joinFoodLabels(foodsEq),
  }
}
