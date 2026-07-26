/**
 * 根据身高体重、体脂、当前身材例图，评估训练负荷倾向。
 * 用于调整组次数、每日动作量与休息日建议。
 */

/**
 * @typedef {'build' | 'balance' | 'cut'} LoadGoal
 * build = 增肌容量偏高；balance = 均衡；cut = 控脂 / 控制容量 + 有氧
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
 * @param {import('./storage').UserProfile} profile
 * @returns {BodyLoadAssessment}
 */
export function assessBodyLoad(profile = {}) {
  const bmi = calcBmi(profile)
  const bodyFat = toNumber(profile.bodyFat)
  const bodyTypeId = profile.currentBodyTypeId || ''
  const highBf = isHighBodyFat(profile)

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
    highBf === true
  ) {
    goal = 'cut'
    if (bodyTypeId === 'heavy') reasons.push('当前身材偏胖')
    if (bmi != null && bmi >= 25) reasons.push(`BMI ${bmi} 偏高`)
    if (highBf === true) reasons.push(`体脂 ${bodyFat}% 偏高`)
  }

  // 体型例图与 BMI 冲突时：体脂/BMI 权重大于例图「匀称」
  if (bodyTypeId === 'average' && goal === 'balance') {
    reasons.push('身材匀称，保持均衡容量')
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

  return {
    bmi,
    bodyFat,
    bodyTypeId,
    goal,
    goalLabel: meta.goalLabel,
    summary: `${reasons.join('，')}。${meta.summary}`,
    exerciseDelta: meta.exerciseDelta,
    volumeKey: meta.volumeKey,
    tips: meta.tips,
  }
}
