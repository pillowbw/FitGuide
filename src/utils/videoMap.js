/**
 * 视频映射工具：将动作 ID 映射到 YouTube 视频 URL
 * 数据来源：fit-distance-matched.json (26 个精确匹配)
 *             fit-distance-exercise-videos.json (1183 个通用视频库)
 */
import fitDistanceMatched from '../data/fit-distance-matched.json'
import fitDistanceVideos from '../data/fit-distance-exercise-videos.json'

/** exerciseId → 精确匹配的视频 */
const EXACT_MATCH = {}
for (const item of fitDistanceMatched) {
  EXACT_MATCH[item.id] = {
    url: item.url,
    title: item.title,
    id: extractYouTubeId(item.url),
  }
}

/** 从 fit-distance 通用视频库中按标题关键词匹配动作 */
const GENERAL_VIDEOS = fitDistanceVideos.map((v) => ({
  ...v,
  youtubeId: v.id,
  thumb: `https://img.youtube.com/vi/${v.id}/mqdefault.jpg`,
  thumbHq: `https://img.youtube.com/vi/${v.id}/hqdefault.jpg`,
}))

/** 动作名关键词 → 视频列表 */
const KEYWORD_MAP = {
  push_up: ['push up', 'pompes', 'flexiones'],
  bench_press: ['bench press', 'développé', 'press banca'],
  dumbbell_chest_press: ['dumbbell press', 'haltères', 'halteres'],
  squat: ['squat', 'sentadilla'],
  deadlift: ['deadlift', 'soulevé'],
  lat_pulldown: ['lat pulldown', 'tractions', 'dominadas'],
  pull_up: ['pull up', 'chin up', 'tractions', 'dominadas'],
  barbell_row: ['row', 'barbell row', 'remise'],
  shoulder_press: ['shoulder press', 'military press', 'press hombro'],
  lateral_raise: ['lateral raise', 'élévation latérale', 'elevacion lateral'],
  bicep_curl: ['curl', 'bicep', 'biseps'],
  tricep_pushdown: ['tricep', 'pushdown', 'extensión'],
  leg_press: ['leg press'],
  leg_curl: ['leg curl', 'isquios'],
  calf_raise: ['calf raise', 'élévation mollet', 'pantorrilla'],
  plank: ['plank', 'gainage', 'plancha'],
  russian_twist: ['russian twist', 'torsión'],
  face_pull: ['face pull'],
  cable_fly: ['cable fly', 'écarté', 'aperturas'],
  lunges: ['lunge', 'fentes', 'zancadas'],
}

/**
 * 获取动作对应的视频信息
 * @param {string} exerciseId - 动作 ID
 * @param {string} exerciseName - 动作名称（用于关键词匹配）
 * @returns {{ url: string, youtubeId: string, thumb: string, title: string } | null}
 */
export function getVideoForExercise(exerciseId, exerciseName) {
  // 1. 精确匹配优先
  if (EXACT_MATCH[exerciseId]) {
    const m = EXACT_MATCH[exerciseId]
    return {
      url: m.url,
      youtubeId: m.id,
      thumb: `https://img.youtube.com/vi/${m.id}/hqdefault.jpg`,
      title: m.title,
    }
  }

  // 2. 关键词匹配
  const keywords = KEYWORD_MAP[exerciseId] || [exerciseName.toLowerCase()]
  for (const kw of keywords) {
    const found = GENERAL_VIDEOS.find((v) =>
      v.title.toLowerCase().includes(kw.toLowerCase()),
    )
    if (found) {
      return {
        url: found.url,
        youtubeId: found.youtubeId,
        thumb: found.thumbHq,
        title: found.title,
      }
    }
  }

  return null
}

/**
 * 获取视频缩略图 URL
 */
export function getThumb(exerciseId, exerciseName) {
  const video = getVideoForExercise(exerciseId, exerciseName)
  return video?.thumb || null
}

function extractYouTubeId(url) {
  const match = url.match(/[?&]v=([^&]+)/)
  return match ? match[1] : null
}
