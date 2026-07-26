/**
 * 根据身高体重、体脂、当前身材例图、性别，评估训练负荷倾向。
 * 用于调整组次数、每日动作量与休息日建议。
 */

import planRules from '../data/planRules.json'

/**
 * @typedef {'build' | 'balance' | 'cut'} LoadGoal
 * build = 增肌容量偏高；balance = 均衡；cut = 控脂 / 控制容量 + 有氧
 */

/**
 * @typedef {'light' | 'mid' | 'heavy'} WeightBand
 */

/**
 * @typedef {Object} BodyLoadAssessment
 * @property {number|null} bmi
 * @property {number|null} bodyFat
 * @property {string} bodyTypeId
 * @property {LoadGoal} goal
 * @property {string} goalLabel
 * @property {string} summary
 * @property {number} exerciseDelta  相对默认每日动作数的增减
 * @property {string} volumeKey     对应 planRules.volumeByGoal
 * @property {WeightBand|null} weightBand
 * @property {number|null} weightKg
 * @property {string[]} tips
 */

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** @param {{ height?: number|null, weight?: number|null }} profile */
export function calcBmi(profile) {
  const heightCm = toNumber(profile?.height)
  const weightKg = toNumber(profile?.weight)
  if (!heightCm || !weightKg || heightCm < 100 || heightCm > 250) return null
  const m = heightCm / 100
  return Math.round((weightKg / (m * m)) * 10) / 10
}

/**
 * 体脂是否偏高（有填写时优先用；阈值按性别粗分）
 * @param {{ bodyFat?: number|null, gender?: string }} profile
 */
export function isHighBodyFat(profile) {
  const bf = toNumber(profile?.bodyFat)
  if (bf == null) return null
  if (profile?.gender === 'female') return bf >= 30
  if (profile?.gender === 'male') return bf >= 22
  return bf >= 26
}

/**
 * 相对性别参考体重的分档，用于微调每日动作量。
 * @param {{ weight?: number|null, gender?: string }} profile
 * @returns {WeightBand|null}
 */
export function resolveWeightBand(profile = {}) {
  const weight = toNumber(profile.weight)
  if (weight == null || weight <= 0) return null

  const refs = planRules.weightBandRefs || {}
  const gender = profile.gender || 'other'
  const ref = refs[gender] ?? refs.other ?? 63

  if (weight < ref * 0.88) return 'light'
  if (weight > ref * 1.15) return 'heavy'
  return 'mid'
}

/**
 * 腰臀比偏高时略偏控脂（有填写腰围/臀围时）。
 * @param {{ waist?: number|null, hip?: number|null, gender?: string }} profile
 */
function waistHipCutSignal(profile) {
  const waist = toNumber(profile.waist)
  const hip = toNumber(profile.hip)
  if (!waist || !hip || hip <= 0) return false
  const ratio = waist / hip
  if (profile.gender === 'female') return ratio >= 0.85
  if (profile.gender === 'male') return ratio >= 0.95
  return ratio >= 0.9
}

/**
 * @param {import('./storage').UserProfile} profile
 * @returns {BodyLoadAssessment}
 */
export function assessBodyLoad(profile = {}) {
  const bmi = calcBmi(profile)
  const bodyFat = toNumber(profile.bodyFat)
  const bodyTypeId = profile.currentBodyTypeId || ''
  const highBf = isHighBodyFat(profile)
  const weightKg = toNumber(profile.weight)
  const weightBand = resolveWeightBand(profile)
  const whrCut = waistHipCutSignal(profile)

  /** @type {LoadGoal} */
  let goal = 'balance'
  const reasons = []

  if (bodyTypeId === 'slim' || (bmi != null && bmi < 18.5)) {
    goal = 'build'
    if (bodyTypeId === 'slim') reasons.push('当前身材偏瘦')
    if (bmi != null && bmi < 18.5) reasons.push(`BMI ${bmi} 偏低`)
  }

  if (
    bodyTypeId === 'heavy' ||
    (bmi != null && bmi >= 25) ||
    highBf === true ||
    whrCut
  ) {
    goal = 'cut'
    if (bodyTypeId === 'heavy') reasons.push('当前身材偏胖')
    if (bmi != null && bmi >= 25) reasons.push(`BMI ${bmi} 偏高`)
    if (highBf === true) reasons.push(`体脂 ${bodyFat}% 偏高`)
    if (whrCut) reasons.push('腰臀比例偏高')
  }

  // 体型例图与 BMI 冲突时：体脂/BMI 权重大于例图「匀称」
  if (bodyTypeId === 'average' && goal === 'balance') {
    reasons.push('身材匀称，保持均衡容量')
  }

  if (weightKg != null && weightBand) {
    const bandLabel =
      weightBand === 'light' ? '偏轻' : weightBand === 'heavy' ? '偏重' : '中等'
    reasons.push(`体重 ${weightKg} kg（相对同性别参考${bandLabel}）`)
  }

  if (!reasons.length) {
    if (bmi != null) reasons.push(`BMI ${bmi}`)
    else reasons.push('基础信息有限，按均衡容量安排')
  }

  const meta = {
    build: {
      goalLabel: '增肌导向',
      summary: '建议稍高训练容量，复合动作为主，配合充足饮食与恢复。',
      exerciseDelta: 1,
      volumeKey: 'build',
      tips: [
        '组间休息可稍长（2–3 分钟），保证动作质量',
        '优先练到接近力竭的有效组，而不是盲目加组',
        '休息日以恢复为主，不必额外长有氧',
      ],
    },
    balance: {
      goalLabel: '均衡塑形',
      summary: '按中等容量安排力量训练，推拉腿比例尽量均衡。',
      exerciseDelta: 0,
      volumeKey: 'balance',
      tips: [
        '可按自身恢复情况每周微调 1 个动作',
        '饮食接近维持热量，配合蛋白质摄入',
      ],
    },
    cut: {
      goalLabel: '控脂导向',
      summary: '力量训练保留肌肉，容量适中；休息日加低强度有氧更稳妥。',
      exerciseDelta: -1,
      volumeKey: 'cut',
      tips: [
        '组间休息略缩短（约 60–90 秒），控制总时长',
        '优先复合动作，孤立动作可减量',
        '休息日建议 20–30 分钟快走 / 骑车',
      ],
    },
  }[goal]

  let exerciseDelta = meta.exerciseDelta
  if (weightBand === 'light') {
    // 相对同性别偏轻：略减每日动作，降低恢复压力
    exerciseDelta -= 1
  } else if (weightBand === 'heavy' && goal !== 'cut') {
    // 体重偏高但仍非控脂：可略增复合容量
    exerciseDelta += 1
  } else if (weightBand === 'heavy' && goal === 'cut') {
    // 控脂且体重偏高：保持精简，不再额外减（已有 -1）
    exerciseDelta -= 0
  }

  if (profile.gender === 'female' && goal === 'build') {
    meta.tips = [
      ...meta.tips,
      '女性增肌同样需要渐进超负荷，不必回避复合动作',
    ]
  }
  if (profile.gender === 'male' && goal === 'cut') {
    meta.tips = [
      ...meta.tips,
      '男性控脂期仍保持推拉均衡，避免只练胸忽略背',
    ]
  }

  return {
    bmi,
    bodyFat,
    bodyTypeId,
    goal,
    goalLabel: meta.goalLabel,
    summary: `${reasons.join('，')}。${meta.summary}`,
    exerciseDelta,
    volumeKey: meta.volumeKey,
    weightBand,
    weightKg,
    tips: meta.tips,
  }
}
