/** @typedef {'upper'|'lower'|'core'|'cardio'|'strength'} ExerciseCategory */

export const GENERIC_ENCOURAGEMENT = [
  '🔥 太棒了！完成一个动作，就是距离目标更近一步！',
  '💪 做得很好！你的坚持正在塑造更强大的自己。',
  '🏆 动作完成！今天的努力会成为未来的底气。',
  '⚡ 非常不错！保持节奏，你正在超越昨天的自己。',
  '🔥 又完成一个挑战！你的身体正在适应并变得更强。',
  '👏 完美完成！不要小看每一次训练积累的力量。',
  '🚀 继续保持，你正在建立属于自己的健身习惯。',
]

/** @type {Record<string, string[]>} */
const EXERCISE_SPECIFIC = {
  bench_press: [
    '🔥 卧推完成！胸部力量正在积累，坚持训练，你会看到变化。',
    '💪 杠铃卧推完成！推起的不只是重量，还有更强的自信。',
  ],
  dumbbell_chest_press: [
    '🔥 哑铃卧推完成！胸部力量正在积累，下一个动作继续挑战！',
  ],
  push_up: [
    '💪 俯卧撑完成！自重训练同样强大，你正在用身体重量雕刻力量。',
  ],
  squat: [
    '🔥 深蹲完成！腿部力量正在成长，稳定的下盘是强大身体的基础。',
    '🏆 深蹲完成！每一次下蹲与站起，都在夯实你的下肢根基。',
  ],
  goblet_squat: [
    '🔥 高脚杯深蹲完成！腿部力量正在升级，核心稳定也在同步提升。',
  ],
  deadlift: [
    '💪 硬拉完成！后链力量是整体表现的核心，你刚刚完成了一次硬核训练。',
  ],
  rdl: [
    '🔥 罗马尼亚硬拉完成！腘绳肌与臀部正在变得更强韧。',
  ],
  pull_up: [
    '🏆 引体向上完成！背部与上肢拉力又进了一步，这很不容易。',
  ],
  lat_pulldown: [
    '💪 高位下拉完成！背阔肌正在变宽，拉出的不只是重量，还有体态。',
  ],
  plank: [
    '⚡ 平板支撑完成！核心稳定性正在提升，静力同样值得骄傲。',
  ],
  mountain_climber: [
    '🔥 登山跑完成！心肺与核心同时被点燃，节奏感越来越好了。',
  ],
  overhead_press: [
    '💪 推举完成！肩部力量正在积累，稳定的推举来自日复一日的坚持。',
  ],
  leg_press: [
    '🔥 腿举完成！下肢力量正在升级，下一组继续挑战自己。',
  ],
}

/** @type {Record<ExerciseCategory, string[]>} */
const CATEGORY_TEMPLATES = {
  upper: [
    '🔥 {name}完成！上肢力量正在积累，下一个动作继续挑战！',
    '💪 {name}完成！推拉之间的每一次重复，都在雕刻更强上肢。',
    '🏆 {name}完成！肩背胸臂协同发力，你正在建立完整的上肢能力。',
  ],
  lower: [
    '🔥 {name}完成！腿部力量正在升级，稳定的下盘是强大身体的基础。',
    '💪 {name}完成！每一次蹬地、蹲起，都在夯实下肢根基。',
    '🏆 {name}完成！臀腿力量是你运动表现的发动机。',
  ],
  core: [
    '⚡ {name}完成！核心稳定性正在提升，强大的中段支撑一切动作。',
    '🔥 {name}完成！腹部与深层核心正在变得更可靠。',
    '💪 {name}完成！稳住核心，就稳住了训练质量。',
  ],
  cardio: [
    '🔥 {name}完成！心肺能力正在提升，每一步都是进步。',
    '⚡ {name}完成！节奏与呼吸配合得越来越好，耐力在悄悄增长。',
    '🚀 {name}完成！有氧训练让你更有活力，继续冲！',
  ],
  strength: [
    '🔥 {name}完成！今天的努力正在一点点改变你的身体，坚持就是最强的训练装备！',
    '💪 {name}完成！又完成一个挑战，肌肉正在记住你的付出。',
    '🏆 {name}完成！每一次训练都是向更好的自己靠近一步。',
  ],
}

const CARDIO_KEYWORDS =
  /跑|跳绳|波比|开合跳|登山|有氧|慢跑|冲刺|划船|椭圆|单车|burpee|run|jump rope|bike|rower/i
const CORE_MUSCLES = new Set(['abs', 'obliques'])
const LOWER_PATTERNS = new Set(['squat', 'lunge', 'hinge'])
const UPPER_PATTERNS = new Set([
  'horizontal_press',
  'vertical_press',
  'pull',
  'isolation',
])

let lastMessageIndex = -1

/**
 * @param {object} exercise
 * @returns {ExerciseCategory}
 */
export function classifyExercise(exercise) {
  const name = exercise?.name || ''
  const pattern = exercise?.pattern || ''
  const muscleIds = exercise?.muscleIds || []

  if (CARDIO_KEYWORDS.test(name)) return 'cardio'
  if (pattern === 'core' || muscleIds.some((id) => CORE_MUSCLES.has(id))) {
    if (!CARDIO_KEYWORDS.test(name)) return 'core'
    return 'cardio'
  }
  if (LOWER_PATTERNS.has(pattern)) return 'lower'
  if (muscleIds.some((id) => ['quads', 'glutes', 'hamstrings', 'calves'].includes(id))) {
    return 'lower'
  }
  if (UPPER_PATTERNS.has(pattern)) return 'upper'
  if (
    muscleIds.some((id) =>
      ['chest', 'back', 'shoulders', 'biceps', 'triceps', 'traps', 'lats'].includes(id),
    )
  ) {
    return 'upper'
  }
  return 'strength'
}

function pickRandomMessage(pool) {
  if (!pool.length) return GENERIC_ENCOURAGEMENT[0]
  if (pool.length === 1) {
    lastMessageIndex = 0
    return pool[0]
  }

  let index = Math.floor(Math.random() * pool.length)
  if (index === lastMessageIndex) {
    index = (index + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length
  }
  lastMessageIndex = index
  return pool[index]
}

function applyExerciseName(template, exerciseName) {
  return template.replaceAll('{name}', exerciseName)
}

/**
 * @param {object} exercise
 * @returns {string}
 */
export function getExerciseEncouragement(exercise) {
  const name = exercise?.name || '这个动作'
  const specific = EXERCISE_SPECIFIC[exercise?.id]
  if (specific?.length) {
    return pickRandomMessage(specific)
  }

  const category = classifyExercise(exercise)
  const categoryPool = CATEGORY_TEMPLATES[category].map((line) =>
    applyExerciseName(line, name),
  )

  return pickRandomMessage([...categoryPool, ...GENERIC_ENCOURAGEMENT])
}

/** @param {import('./storage').CompletedExercise} item */
export function shouldShowExerciseReward(item) {
  if (!item) return false
  if (item.rewardShown === true) return false
  if (item.rewardShown === false) return true
  // 旧数据没有 rewardShown 字段，视为已展示，避免刷新后批量弹窗
  return false
}
