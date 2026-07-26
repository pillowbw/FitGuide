const REGION_LABEL = {
  upper: '上肢',
  core: '核心',
  lower: '下肢',
  full: '全身',
}

function profileHint(profile) {
  const parts = []

  if (profile.goalRegion && REGION_LABEL[profile.goalRegion]) {
    parts.push(`你目前档案里目标部位是${REGION_LABEL[profile.goalRegion]}`)
  }

  if (profile.selectedMuscleIds?.length) {
    parts.push(`已选 ${profile.selectedMuscleIds.length} 个目标肌肉`)
  }

  if (profile.height && profile.weight) {
    parts.push(`身高 ${profile.height} cm、体重 ${profile.weight} kg`)
  }

  if (parts.length === 0) return ''

  return `\n\n（结合你的 FitGuide 档案：${parts.join('；')}。）`
}

function matchReply(message, profile) {
  const hint = profileHint(profile)

  if (/3\s*天|三天|每周.*3/.test(message)) {
    return `三天练一次完整循环很合理。建议按「推（胸肩三头）→ 拉（背二头）→ 腿（臀腿核心）」安排，每次 45～60 分钟，每个主要动作 3～4 组。

第一天推，第二天拉，第三天腿；第四天休息。动作质量优先，每周尽量让同一肌群被练到 2 次左右。${hint}

你更偏向增肌、减脂，还是先把动作练标准？`
  }

  if (/不酸|没酸|没有酸|白练/.test(message)) {
    return `没有酸痛不代表白练。肌肉不会用「第二天疼不疼」来打分，更可靠的是：动作是否更稳定、重量或次数有没有慢慢提高、以及几周后力量和线条的变化。

新手前几次常会酸，适应后酸痛感下降很正常，说明恢复和神经适应在起作用。${hint}`
  }

  if (/减脂.*力量|力量.*减脂|减肥.*力量/.test(message)) {
    return `减脂期间非常建议保留力量训练。它帮你留住肌肉，让减下来的是脂肪而不是「力气」；同时提高日常消耗，身材也更容易好看。

做法上：饮食制造温和热量缺口，蛋白质吃够（大致每公斤体重 1.6～2 g），力量训练每周 2～4 次，有氧作为补充而不是唯一手段。${hint}`
  }

  if (/重量|多重|加组|组数/.test(message)) {
    return `判断重量是否合适，可以记一个简单标准：目标组数里，最后 1～2 次要「很吃力但动作不变形」。

如果每组都还能轻松多做 5 次以上，通常可以加重；如果第 3 次就开始变形，就先减重，把节奏和幅度练稳。${hint}`
  }

  if (/腿疼|练完.*疼|练完腿|深蹲.*疼|膝盖/.test(message)) {
    return `练完腿有些延迟性酸痛（24～72 小时）在初学者里很常见，通常是肌肉在适应新刺激；但如果出现关节 sharp 痛、肿胀、某侧明显不稳或疼痛持续加重，就先停掉诱发痛的动作。

一般建议：48 小时内轻活动；下次训练先降容量，从可控制的动作幅度开始。若超过一周仍痛，建议咨询医生或物理治疗师。${hint}

你的疼是肌肉酸胀，还是膝盖/髋部关节在痛？`
  }

  if (/腹肌|练腹|马甲线|六块/.test(message)) {
    return `腹肌更像「隐藏角色」：能不能看见主要取决于体脂够不够低，以及核心整体力量够不够。

训练上：卷腹、死虫、平板支撑都可以；但更关键是整体力量训练 + 饮食控制 + 睡眠。别指望只练腹就局部变瘦。${hint}`
  }

  if (/蛋白粉|智商税/.test(message)) {
    return `蛋白粉不是智商税，但也不是必需品。它本质是「方便的蛋白质来源」，适合训练后补蛋白、或者日常肉蛋奶吃不够的人。

如果你三餐能吃到足够蛋白质，完全可以不买。${hint}`
  }

  if (/女生.*力量|力量.*女生|变壮/.test(message)) {
    return `女生练力量不会轻易练成「大块头」。普通力量训练更多是让线条更紧致、代谢更好、骨骼更强。

建议从全身复合动作为主：深蹲、硬拉、推举、划船，每周 2～3 次就很有价值。${hint}`
  }

  if (/新手|刚开始|入门/.test(message)) {
    return `新手最好的开始方式：每周 2～3 次全身训练，每次 5～6 个基础动作，先把深蹲、推举、划船这类动作练稳。

前 4～8 周别急着上大重量，重点是学会呼吸、节奏和关节对齐。${hint}

你打算在家练还是去健身房？`
  }

  if (/没变化|一个月|为什么/.test(message)) {
    return `一个月变化不明显太正常了。更常见原因是：训练容量不够稳定、蛋白质或睡眠没跟上、或者期望是「体重」而不是「围度/力量」。

建议记录：每周同一动作的重量/次数、腰围或照片、睡眠时长。连续看 4～6 周趋势更有用。${hint}`
  }

  if (/深蹲/.test(message)) {
    return `深蹲不是越深越有诚意，而是在脚跟稳定、膝盖方向可控、腰背保持中立的范围内尽量下蹲。

先从不疼痛、不变形的深度开始，再通过踝关节活动度和核心稳定慢慢加深。${hint}`
  }

  if (/跑步|有氧|力量.*哪个/.test(message)) {
    return `跑步和力量训练不是二选一。减脂：力量保肌肉，有氧补消耗；增肌：力量为主，有氧适量即可。

如果时间有限，每周 2 次力量 + 1～2 次 20～30 分钟快走/慢跑，对大多数人已经很均衡。${hint}`
  }

  return `这是个好问题。我可以给你一般性建议：先把目标拆成「训练频率、动作质量、恢复和饮食」四块，每次只改一个变量，坚持 3～4 周再看变化。

你可以具体说说：你的目标（增肌/减脂/力量）、每周能练几天、有没有器械或伤病？${hint}`
}

/**
 * 无 OpenAI Key 时的本地演示教练，保证演示可用。
 * @param {string} message
 * @param {Record<string, unknown>} profile
 */
export function getDemoCoachReply(message, profile = {}) {
  return {
    text: matchReply(message, profile),
    responseId: `demo-${Date.now()}`,
    mode: 'demo',
  }
}
