const REGION_LABEL = {
  upper: '上肢',
  core: '核心',
  lower: '下肢',
  full: '全身',
}

const TARGET_BODY_LABEL = {
  athletic: '匀称运动型',
  v_taper: '倒三角型',
  lower_strong: '下肢力量型',
}

const GENDER_LABEL = {
  male: '男性',
  female: '女性',
  other: '其他',
}

const WEEKDAY_ALIASES = [
  { keys: ['周一', '星期一', '礼拜一'], label: '周一' },
  { keys: ['周二', '星期二', '礼拜二'], label: '周二' },
  { keys: ['周三', '星期三', '礼拜三'], label: '周三' },
  { keys: ['周四', '星期四', '礼拜四'], label: '周四' },
  { keys: ['周五', '星期五', '礼拜五'], label: '周五' },
  { keys: ['周六', '星期六', '礼拜六'], label: '周六' },
  { keys: ['周日', '周天', '星期日', '星期天', '礼拜日'], label: '周日' },
]

const INJURY_LABEL = {
  knee: '膝盖',
  shoulder: '肩部',
  lower_back: '腰部',
  wrist: '手腕',
  elbow: '肘部',
  ankle: '踝关节',
  hip: '髋部',
  neck: '颈部',
}

const POSTURE_LABEL = {
  kyphosis: '驼背',
  rounded_shoulders: '圆肩',
  forward_head: '头前伸',
  anterior_pelvic_tilt: '骨盆前倾',
  disc_herniation: '腰间盘突出',
}

function profileHint(profile) {
  const parts = []

  if (profile.gender && GENDER_LABEL[profile.gender]) {
    parts.push(`性别 ${GENDER_LABEL[profile.gender]}`)
  }

  if (profile.targetBodyTypeId && TARGET_BODY_LABEL[profile.targetBodyTypeId]) {
    parts.push(`目标体型是${TARGET_BODY_LABEL[profile.targetBodyTypeId]}`)
  }

  if (profile.goalRegion && REGION_LABEL[profile.goalRegion]) {
    parts.push(`目标部位是${REGION_LABEL[profile.goalRegion]}`)
  }

  if (profile.selectedMuscleIds?.length) {
    parts.push(`已选 ${profile.selectedMuscleIds.length} 个目标肌肉`)
  }

  if (profile.height && profile.weight) {
    parts.push(`身高 ${profile.height} cm、体重 ${profile.weight} kg`)
  }

  if (profile.injuries?.length) {
    const labels = profile.injuries
      .map((id) => INJURY_LABEL[id] || id)
      .filter(Boolean)
    if (labels.length) {
      parts.push(`需避开加重 ${labels.join('、')} 不适的动作`)
    }
  }

  if (profile.postures?.length) {
    const labels = profile.postures
      .map((id) => POSTURE_LABEL[id] || id)
      .filter(Boolean)
    if (labels.length) {
      parts.push(`体态问题含 ${labels.join('、')}，训练中会穿插改善体态动作`)
    }
  }

  if (parts.length === 0) return ''

  return `\n\n（结合你的档案：${parts.join('；')}。）`
}

function detectWeekdays(message) {
  return WEEKDAY_ALIASES.filter((day) =>
    day.keys.some((key) => message.includes(key)),
  ).map((day) => day.label)
}

function parseMinutes(message) {
  const match = message.match(/(\d+)\s*(分钟|min)/i)
  if (match) return Number(match[1])

  if (/半小时|半个小时/.test(message)) return 30
  if (/一刻钟/.test(message)) return 15
  if (/一小时|1\s*小时/.test(message)) return 60

  return null
}

function summarizePlanDays(plan) {
  if (!plan?.days?.length) return []

  return plan.days.map((day) => {
    const names = (day.exercises || [])
      .map((ex) => ex.name)
      .filter(Boolean)
      .slice(0, 4)
    return {
      day: day.day || '训练日',
      title: day.sessionTitle || day.focus || '训练',
      names,
    }
  })
}

function buildExerciseSwapReply(message, profile, plan) {
  const isDislike =
    /不喜欢|讨厌|不想做|做不来|换掉|换成|换一个|换成别的|别再安排|太难了|受不了|替代/.test(
      message,
    )
  if (!isDislike) return null

  const knownNames = []
  const nameHints = [
    '引体向上',
    '反手引体向上',
    '俯卧撑',
    '深蹲',
    '硬拉',
    '卧推',
    '高位下拉',
    '坐姿划船',
    '杠铃划船',
  ]
  for (const name of nameHints) {
    if (message.includes(name)) knownNames.push(name)
  }
  if (/引体/.test(message) && !knownNames.some((n) => n.includes('引体'))) {
    knownNames.push('引体向上')
  }

  if (knownNames.length === 0) {
    return {
      text: '可以。告诉我具体是哪个动作（例如「引体向上」），我就在计划里换成同类替代。',
      action: null,
    }
  }

  const planDays = summarizePlanDays(plan)
  const lines = [
    `收到。我会把「${knownNames.join('、')}」记成不喜欢的动作，并在页面计划里换成同类训练。`,
    '',
  ]

  if (planDays.length > 0) {
    lines.push('替换原则：优先同发力模式、同肌群（例如引体 → 高位下拉 / 反向划船）。')
    lines.push('你现在可以直接看计划表，对应动作应已更新。')
  } else {
    lines.push('你还没有生成周计划；我先记下偏好，生成后会自动避开这些动作。')
  }

  lines.push(profileHint(profile))

  return {
    text: lines.filter(Boolean).join('\n'),
    action: {
      action: 'replace_exercise',
      exerciseNames: knownNames,
    },
  }
}

function buildAdjustedPlanReply(message, profile, plan) {
  const blockedDays = detectWeekdays(message)
  const minutes = parseMinutes(message)
  const hint = profileHint(profile)
  const planDays = summarizePlanDays(plan)

  const isSkip =
    /练不了|没法练|没时间|请假|有事|取消|跳过|休息|去不了|避开|别安排|不要安排/.test(
      message,
    )
  const isShort =
    minutes != null ||
    /只能练|时间不够|很赶|短训|压缩|匆忙/.test(message)

  if (!isSkip && !isShort && !/调整|改计划|换一天|补练|顺延/.test(message)) {
    return null
  }

  const lines = []
  /** @type {Record<string, unknown>|null} */
  let action = null

  if (planDays.length > 0) {
    lines.push(
      `收到。我会按你的时间约束直接改写页面上的「${plan.weekLabel || '本周计划'}」。`,
    )
  } else {
    lines.push(
      '收到。你这边还没有保存周计划；我可以先记下不可练的日子，你生成计划后我会自动避开这些天。',
    )
  }

  if (blockedDays.length > 0 && isSkip) {
    action = {
      action: 'adjust_schedule',
      blockedWeekdays: blockedDays,
    }
    const day = blockedDays.join('、')
    lines.push('')
    lines.push(`【已处理】避开 ${day}，重新安排训练日。`)
    lines.push('原则：保住每周训练次数和恢复间隔，不把两天硬塞到相邻日。')

    if (planDays.length > 0) {
      lines.push('')
      lines.push('当前计划里的课次（已按新日程落在页面上）：')
      for (const item of planDays) {
        const moves =
          item.names.length > 0 ? `：${item.names.join('、')}` : ''
        lines.push(`- ${item.day}：${item.title}${moves}`)
      }
    } else {
      lines.push(
        `- ${day}：休息\n- 其余训练日：推（胸肩三头）→ 拉（背二头）→ 腿（臀腿核心）`,
      )
    }
  } else if (blockedDays.length > 0 && isShort) {
    const day = blockedDays[0]
    const budget = minutes || 30
    lines.push('')
    lines.push(
      `【调整重点】${day}只留约 ${budget} 分钟：砍孤立动作，保留 3 个复合动作，组间休息压到 60～75 秒。`,
    )

    const target = planDays.find(
      (item) => item.day.includes(day.replace('周', '')) || item.day === day,
    )
    const shortList =
      target?.names?.slice(0, 3) ||
      ['深蹲/弓步', '俯卧撑/推举', '划船/反向划船']

    lines.push(`短训菜单：${shortList.join('、')}，各 3 组，做到接近力竭但动作不散。`)
    lines.push('其他训练日保持原计划，不必因为短训日去“加练补偿”。')
  } else if (isShort) {
    const budget = minutes || 30
    lines.push('')
    lines.push(
      `时间紧就按 ${budget} 分钟短训：选 3 个大肌群复合动作，每个 3 组，热身 3 分钟，直接开练。`,
    )
    lines.push(
      '示例：下肢推 + 水平推 + 水平拉。做完就收工，别为了“练满”硬拖到第二天报复性加量。',
    )
  } else {
    lines.push('')
    lines.push(
      '可以。告诉我「哪一天、有多少分钟、想保哪个肌群」，我就按你的计划给出逐日替换版。',
    )
  }

  lines.push(hint)
  if (!action) {
    lines.push(
      '\n你更希望：把落下的内容补回来，还是本周直接减量、保证完成质量？',
    )
  } else {
    lines.push('\n页面计划表已同步更新；若之后某天又能练了，直接跟我说即可。')
  }

  return {
    text: lines.filter(Boolean).join('\n'),
    action,
  }
}

function buildPainOrFormReply(message, profile) {
  const hint = profileHint(profile)

  if (/俯卧撑|伏地挺身/.test(message) && /腰|下背|腰椎/.test(message)) {
    return `俯卧撑后腰酸，很常见，通常不是“腰肌练到位了”，而是髋和核心没把身体撑成一条板——臀掉下去或塌腰时，下背会代偿着撑住。

先自查三件事：1）全程收紧腹部和下巴微收；2）屁股不要比肩低；3）手肘大约 45° 夹肋，别过度耸肩。若还是容易塌，先改跪姿俯卧撑或高位俯卧撑（手撑桌子），把核心稳住再回到地面版。

如果是关节尖锐痛、往腿上窜的放射痛或麻木，就先停，并考虑就医评估。${hint}

你是动作做到一半就开始酸，还是练完几小时后才酸？`
  }

  if (/深蹲/.test(message) && /膝|膝盖/.test(message)) {
    return `深蹲后膝盖不适，先分清是「肌肉酸」还是「关节刺痛」。前者多在大腿前侧/后侧，后者常在膝盖骨周围或内侧，并可能在上下楼时加重。

常见原因：膝盖过度内扣、重心太靠前、深度超出当前控制能力。建议先减小幅度，让膝盖指向脚尖方向，脚掌均匀踩地；疼痛时先换成腿推或箱式深蹲。

持续肿胀、卡顿或不稳，请暂停并咨询专业人员。${hint}`
  }

  if (/肩|肩膀/.test(message) && /(疼|痛|酸|不适)/.test(message)) {
    return `肩部不适常和「手肘抬太高、肩胛没沉稳、重量超过控制」有关。推类动作时，想象肩胛轻轻后收下沉，手肘别硬举到耳朵旁。

先降重量或改哑铃/器械轨道更稳的变式，热身加上轻量外旋。若有夜间痛醒、抬臂无力或刺痛，建议停训并就医。${hint}`
  }

  if (/(酸|疼|痛|不适|为什么)/.test(message) && /(练|动作|肌|腰|背|腿|膝|肩|肘|腕)/.test(message)) {
    return `练后某个部位有反应，我会先帮你分清：是延迟性肌肉酸痛（通常 24～72 小时、酸胀可活动），还是关节/神经信号（尖锐、放射、麻木、肿胀）。

前者多半说明组织在适应新刺激，可用轻松走路、睡眠和蛋白质支持恢复，下次略减容量即可；后者请先停诱发动作，不要忍痛加练。

你可以补充：具体动作、是哪一侧、疼痛性质（酸胀还是刺痛），我能给更针对性的动作修正。${hint}`
  }

  return null
}

function buildNutritionReply(message, profile) {
  const hint = profileHint(profile)
  const isNutrition =
    /(饮食|吃饭|吃什么|控制饮食|少吃|节食|热量|卡路里|蛋白|碳水|脂肪|减脂|减肥|体脂|增肌吃|补剂|蛋白粉|睡眠|喝水|体重|平台期|零食|夜宵)/.test(
      message,
    )

  if (!isNutrition) return null

  if (/控制饮食|少吃|饮食/.test(message) && /(减脂|减肥|掉脂|瘦)/.test(message)) {
    return `是的——同样在练的情况下，日常把饮食管稳，减脂通常会更明显。因为减脂长期看「吃进去的能量 vs 用掉的能量」，训练很重要，但多数人一周练几小时，剩下一百多个小时都在吃和休息，饮食的杠杆往往更大。

做法上别靠饿：做温和缺口就够（例如每餐七八分饱、含糖饮料先减、蛋白质每餐都有一点），再配合力量训练保肌肉。极端节食短期掉秤快，但更容易崩、也更容易掉肌肉。${hint}

你现在更卡在「吃太多零食」，还是「正餐不知道怎么搭配」？我可以帮你缩成两三个好执行的规则。`
  }

  if (/减脂.*力量|力量.*减脂|减肥.*力量/.test(message)) {
    return `减脂期很建议保留力量训练：留肌肉、稳代谢、身材也更好看。饮食温和缺口 + 够蛋白质 + 每周 2～4 次力量，有氧作补充即可。${hint}`
  }

  if (/蛋白粉|智商税/.test(message)) {
    return `蛋白粉是方便的蛋白质来源，不是必需品。三餐蛋白够就可以不买；训练后补或吃不够时再用它更划算。${hint}`
  }

  if (/睡眠|熬夜/.test(message)) {
    return `睡眠会直接影响恢复、食欲和训练表现。长期睡不够，更容易饿、恢复慢、力量也难涨。目标可以先定：尽量固定入睡时间，每周至少大多数夜晚睡够。${hint}`
  }

  if (/平台期|体重不掉|掉不动/.test(message)) {
    return `平台期很常见：身体会适应当前缺口，体重还受水分和肠道内容物影响。先别急着大幅砍热量——检查近两周训练是否稳定、蛋白质是否够、步数/日常活动有没有掉，再考虑小幅调整饮食或加一点日常活动。${hint}`
  }

  return `这类问题和训练目标很相关，我可以给你一般性建议。减脂/控体重大方向是：饮食可长期坚持 + 蛋白质够 + 力量训练保住肌肉；不靠极端节食。

你可以直接问更具体一点，比如「控制饮食对减脂有用吗」「练后要不要马上吃」「零食怎么收」。${hint}`
}

function buildEmotionReply(message, profile) {
  if (
    !/(累|坚持|放弃|不想练|没效果|看不到|没用|焦虑|崩溃|丧|失望|灰心|坚持不下去)/.test(
      message,
    )
  ) {
    return null
  }

  // 「看不到效果」若同时在问饮食/减脂，优先走营养答疑
  if (
    /(饮食|吃饭|减脂|减肥|热量|蛋白|碳水)/.test(message) &&
    !/(累|放弃|不想练|崩溃|丧|灰心|坚持不下去)/.test(message)
  ) {
    return null
  }

  const hint = profileHint(profile)

  return `先说一句：你愿意练满一周还来找我，这件事本身就很不容易——累是真实的，不是你矫情。

很多变化会先发生在“看不见的地方”：动作更稳、恢复变快、睡觉更踏实、脑子里开始有训练节奏。外形和体重常常要 4～6 周才肯露脸，所以你这周的汗绝不是无用功。

今天只做两件小事就够：① 睡够、吃一顿带蛋白质的饭；② 下一练只保证完成，不追求加重量。把“坚持”拆小，反而更容易留下。${hint}

你愿意跟我说：最让你泄气的是体重没变、镜子没变，还是单纯太累了？我陪你一起拆。`
}

function buildGeneralReply(message, profile) {
  const hint = profileHint(profile)

  if (/3\s*天|三天|每周.*3/.test(message)) {
    return `三天练一次完整循环很合适。建议「推（胸肩三头）→ 拉（背二头）→ 腿（臀腿核心）」，每次 45～60 分钟。

若某一天突然没空，直接告诉我「周几练不了」或「只能练多久」，我按你的约束改一版。${hint}`
  }

  if (/不酸|没酸|没有酸|白练/.test(message)) {
    return `没有酸痛不代表白练。更可靠的信号是：动作更稳、次数/重量慢慢涨、几周后力量和体态有变化。适应后酸痛变少，恰恰说明恢复在变强。${hint}`
  }

  if (/重量|多重|加组|组数/.test(message)) {
    return `合适重量的简单标准：目标组数里，最后 1～2 次很吃力但动作不散。还能轻松多做 5 次就加重；第 3 次就变形就减重，先把节奏做稳。${hint}`
  }

  if (/新手|刚开始|入门/.test(message)) {
    return `新手可以从每周 2～3 次全身训练起步，先把深蹲、推、拉练稳。有日程冲突时直接跟我说哪天要改，我帮你压成短训或顺延。${hint}`
  }

  return `我可以帮你：① 按时间改训练安排；② 解释练后酸痛和动作问题；③ 回答饮食/减脂等基础健康问题；④ 在你想放弃时给你务实鼓励。

例如：「周一练不了」「俯卧撑腰酸」「控制饮食减脂更明显吗」「练一周好累想放弃」。${hint}`
}

/**
 * 无 OpenAI Key 时的本地演示教练，保证演示可用。
 * @param {string} message
 * @param {Record<string, unknown>} profile
 * @param {Record<string, unknown>|null} [plan]
 */
export function getDemoCoachReply(message, profile = {}, plan = null) {
  const swap = buildExerciseSwapReply(message, profile, plan)
  const adjusted = buildAdjustedPlanReply(message, profile, plan)
  const text =
    buildEmotionReply(message, profile) ||
    swap?.text ||
    adjusted?.text ||
    buildPainOrFormReply(message, profile) ||
    buildNutritionReply(message, profile) ||
    buildGeneralReply(message, profile)

  return {
    text,
    responseId: `demo-${Date.now()}`,
    mode: 'demo',
    action: swap?.action || adjusted?.action || null,
  }
}
