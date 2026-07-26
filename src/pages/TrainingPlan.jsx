import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FitnessCoach from '../components/FitnessCoach'
import PlanDetailModal from '../components/PlanDetailModal'
import WeeklyPlanOverview from '../components/WeeklyPlanOverview'
import ExerciseCompletionModal from '../components/ExerciseCompletionModal'
import { describeDayBurn, describeWeekBurn } from '../utils/calorieEstimate'
import {
  generatePlan,
  isStalePlan,
  syncPlanWithProfile,
} from '../utils/planGenerator'
import { usePageReveal } from '../hooks/usePageReveal'
import {
  PLAN_SYNCED_EVENT,
  archiveCurrentWeekLog,
  clearPlan,
  ensureCurrentWeekLog,
  getPastWeekLogs,
  getPlan,
  getProfile,
  hasBasicProfile,
  hasPlanSource,
  isExerciseCompleted,
  toggleExerciseCompleted,
  markExerciseRewardShown,
} from '../utils/storage'
import {
  getExerciseEncouragement,
  shouldShowExerciseReward,
} from '../utils/exerciseCompletion'
import { injuryLabelsText } from '../utils/injurySafety'
import { postureLabelsText } from '../utils/postureSafety'
import { youtubeThumbFromUrl } from '../utils/videoMap'
import {
  WEEK_DAYS,
  buildWeekTimeline,
  getDayAnchorId,
  getExerciseAnchorId,
} from '../utils/planOverview'
import planRules from '../data/planRules.json'
import './TrainingPlan.css'

function stretchVideoUrl(item) {
  return (
    item?.videoUrl ||
    planRules.postWorkoutStretches?.[item?.muscleId]?.videoUrl ||
    ''
  )
}

const PATH_LABEL = {
  beginner: '新手推荐',
  advanced: '自选肌肉',
  '': '未选择',
}

const REGION_LABEL = {
  upper: '上肢',
  core: '核心',
  lower: '下肢',
  full: '全身',
  '': '未指定',
}

function formatGeneratedAt(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function formatWeekRange(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}

/** 旧缓存计划把科学说明拼进 note 了，展示时去掉重复 */
function planNoteWithoutScience(plan) {
  if (!plan?.note) return ''
  const science = plan.scienceNote?.trim()
  if (!science) return plan.note
  if (plan.note.startsWith(science)) {
    return plan.note.slice(science.length).trim()
  }
  return plan.note
}

/** 兼容旧计划：无 videoThumb 时从 videoUrl 生成 YouTube 封面 */
function resolveExerciseThumb(ex) {
  return ex.videoThumb || youtubeThumbFromUrl(ex.videoUrl)
}

function ExerciseCareBadges({ exercise }) {
  if (
    !exercise?.lightLoad &&
    !exercise?.injuryRelated &&
    !exercise?.postureRelated
  ) {
    return null
  }
  return (
    <div className="plan-ex-care">
      {exercise.postureRelated && (
        <span className="plan-ex-posture-cue">
          {exercise.loadCue || '改善体态'}
        </span>
      )}
      {exercise.lightLoad && !exercise.postureRelated && (
        <span className="plan-ex-load-cue">
          {exercise.loadCue || '减重减次'}
        </span>
      )}
      {(exercise.careBadge ||
        exercise.injuryRelated ||
        exercise.postureRelated) && (
        <span
          className={
            exercise.postureRelated
              ? 'plan-ex-care-badge plan-ex-posture-badge'
              : 'plan-ex-care-badge'
          }
        >
          {exercise.careBadge ||
            (exercise.postureRelated ? '改善体态' : '相关部位 · 减量')}
        </span>
      )}
    </div>
  )
}

function groupCompletedByDay(completed) {
  const map = new Map()
  for (const item of completed || []) {
    const key = item.day || `第 ${item.dayIndex} 天`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }

  return [...map.entries()]
    .map(([dayName, items]) => [
      dayName,
      [...items].sort(
        (a, b) =>
          new Date(a.completedAt || 0).getTime() -
          new Date(b.completedAt || 0).getTime(),
      ),
    ])
    .sort((a, b) => {
      const ai = WEEK_DAYS.indexOf(a[0])
      const bi = WEEK_DAYS.indexOf(b[0])
      if (ai >= 0 && bi >= 0) return ai - bi
      if (ai >= 0) return -1
      if (bi >= 0) return 1
      return String(a[0]).localeCompare(String(b[0]), 'zh-CN')
    })
}

/** 成员 C：个性化训练计划 */
export default function TrainingPlan() {
  const pageRef = usePageReveal()
  const [profile, setProfile] = useState(() => getProfile())
  const [plan, setPlan] = useState(() => getPlan())
  const [justGenerated, setJustGenerated] = useState(false)
  const [weekLog, setWeekLog] = useState(null)
  const [pastWeeks, setPastWeeks] = useState(() => getPastWeekLogs(6))
  const [historyOpen, setHistoryOpen] = useState(false)
  const [syncedFromProfile, setSyncedFromProfile] = useState(false)
  const [exerciseRewardOpen, setExerciseRewardOpen] = useState(false)
  const [exerciseRewardMessage, setExerciseRewardMessage] = useState('')
  const [exerciseRewardName, setExerciseRewardName] = useState('')
  const [exerciseRewardKey, setExerciseRewardKey] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)

  function applyPlanState(nextPlan, nextProfile, { toast } = {}) {
    if (nextProfile) setProfile(nextProfile)
    setPlan(nextPlan)
    if (nextPlan) {
      setWeekLog(ensureCurrentWeekLog(nextPlan))
    } else {
      setWeekLog(null)
    }
    setPastWeeks(getPastWeekLogs(6))
    if (toast) {
      setJustGenerated(true)
      setSyncedFromProfile(Boolean(toast.fromProfile))
    }
  }

  useEffect(() => {
    const latest = getProfile()
    let activePlan = getPlan()
    if (activePlan && isStalePlan(activePlan, latest)) {
      activePlan = syncPlanWithProfile(latest)
      applyPlanState(activePlan, latest, { toast: { fromProfile: true } })
    } else {
      applyPlanState(activePlan, latest)
    }

    function onPlanSynced(event) {
      const { plan: nextPlan, profile: nextProfile } = event.detail || {}
      applyPlanState(nextPlan || getPlan(), nextProfile || getProfile(), {
        toast: { fromProfile: true },
      })
    }

    window.addEventListener(PLAN_SYNCED_EVENT, onPlanSynced)
    return () => window.removeEventListener(PLAN_SYNCED_EVENT, onPlanSynced)
  }, [])

  const missingBasics = !hasBasicProfile(profile)
  const missingSource = !hasPlanSource(profile)
  const nextPath = profile.path === 'advanced' ? '/anatomy' : '/beginner'
  const nextPathLabel =
    profile.path === 'advanced' ? '自选肌肉' : '新手推荐'

  const weekBurn = useMemo(
    () => (plan ? describeWeekBurn(plan, profile.weight) : null),
    [plan, profile.weight],
  )
  const displayNote = plan ? planNoteWithoutScience(plan) : ''
  const injurySummaryLabel = useMemo(
    () =>
      plan?.injuryCare?.labels ||
      injuryLabelsText(plan?.injuries || profile.injuries),
    [plan, profile.injuries],
  )
  const postureSummaryLabel = useMemo(
    () =>
      plan?.postureCare?.labels ||
      postureLabelsText(plan?.postures || profile.postures),
    [plan, profile.postures],
  )

  const totalExercises = useMemo(
    () =>
      plan?.days?.reduce((sum, day) => sum + (day.exercises?.length || 0), 0) ||
      0,
    [plan],
  )
  const doneCount = weekLog?.completed?.length || 0
  const weekTimeline = useMemo(() => buildWeekTimeline(plan), [plan])

  function handleCloseExerciseReward() {
    if (plan && exerciseRewardKey) {
      const updated = markExerciseRewardShown(plan, exerciseRewardKey)
      if (updated) refreshHistoryViews(updated)
    }
    setExerciseRewardOpen(false)
    setExerciseRewardKey('')
  }

  function showExerciseReward(exercise, item) {
    if (!shouldShowExerciseReward(item)) return
    setExerciseRewardName(exercise.name || item.exerciseName || '')
    setExerciseRewardMessage(getExerciseEncouragement(exercise))
    setExerciseRewardKey(item.key)
    setExerciseRewardOpen(true)
  }

  function refreshHistoryViews(nextWeek) {
    setWeekLog(nextWeek)
    setPastWeeks(getPastWeekLogs(6))
  }

  function handleGenerate() {
    archiveCurrentWeekLog()
    const latest = getProfile()
    setProfile(latest)
    const next = generatePlan(latest)
    setPlan(next)
    setJustGenerated(true)
    setExerciseRewardOpen(false)
    setExerciseRewardKey('')
    refreshHistoryViews(ensureCurrentWeekLog(next))
  }

  function handleClear() {
    clearPlan()
    setPlan(null)
    setJustGenerated(false)
    setWeekLog(null)
    setPastWeeks(getPastWeekLogs(6))
    setExerciseRewardOpen(false)
    setExerciseRewardKey('')
  }

  function handleToggleDone(day, exercise) {
    if (!plan) return
    const { week, done, item } = toggleExerciseCompleted(plan, day, exercise)
    refreshHistoryViews(week)
    if (done && item) {
      showExerciseReward(exercise, item)
    }
  }

  return (
    <section className="page plan-page" ref={pageRef}>
      <header className="plan-hero">
        <p className="eyebrow">Training Plan</p>
        <h1>个性化训练计划</h1>
        <p className="lede">看课表、勾完成，细节点「详情」。</p>
      </header>

      <aside className="plan-summary" aria-label="当前档案摘要">
        <div>
          <span className="plan-summary-label">路径</span>
          <strong>{PATH_LABEL[profile.path] || PATH_LABEL['']}</strong>
        </div>
        <div>
          <span className="plan-summary-label">目标部位</span>
          <strong>
            {REGION_LABEL[profile.goalRegion] || REGION_LABEL['']}
          </strong>
        </div>
        <div>
          <span className="plan-summary-label">已选肌肉</span>
          <strong>
            {profile.selectedMuscleIds?.length
              ? `${profile.selectedMuscleIds.length} 块`
              : '将按部位默认'}
          </strong>
        </div>
        <div>
          <span className="plan-summary-label">本周进度</span>
          <strong>
            {plan ? `${doneCount}/${totalExercises}` : '—'}
          </strong>
        </div>
        <div>
          <span className="plan-summary-label">不适部位</span>
          <strong>
            {injurySummaryLabel ? `${injurySummaryLabel} · 减量安排` : '无'}
          </strong>
        </div>
        <div>
          <span className="plan-summary-label">体态问题</span>
          <strong>
            {postureSummaryLabel ? `${postureSummaryLabel} · 矫正穿插` : '无'}
          </strong>
        </div>
      </aside>

      {missingBasics && (
        <p className="banner">
          档案不完整，建议先去 <Link to="/profile">完善身体档案</Link>
          （性别 / 身高 / 体重），计划提示会更准确。
        </p>
      )}

      {missingSource && (
        <p className="banner">
          还没有目标肌肉。可以先去{' '}
          <Link to={nextPath}>{nextPathLabel}</Link>，或直接生成（将按全身默认排课）。
        </p>
      )}

      <div className="cta-row">
        <button type="button" className="btn btn-primary" onClick={handleGenerate}>
          {plan ? '重新生成计划' : '生成计划'}
        </button>
        {plan && (
          <button type="button" className="btn btn-ghost" onClick={handleClear}>
            清空计划
          </button>
        )}
        <Link className="btn btn-secondary" to={nextPath}>
          调整目标
        </Link>
      </div>

      {justGenerated && plan && (
        <p className="plan-toast" role="status">
          {syncedFromProfile
            ? `已根据最新身体档案更新计划 · ${formatGeneratedAt(plan.generatedAt)}`
            : `已生成并保存到本机 · ${formatGeneratedAt(plan.generatedAt)}`}
        </p>
      )}

      {plan ? (
        <div className="plan-board">
          <header className="plan-board-header">
            <div className="plan-board-title-block">
              <h2>
                {plan.path === 'advanced' ? '进阶分化' : '入门轮换'}
                {plan.bodyLoad?.goalLabel
                  ? ` · ${plan.bodyLoad.goalLabel}`
                  : ''}
              </h2>
              {plan.generatedAt && (
                <time className="plan-time" dateTime={plan.generatedAt}>
                  {formatGeneratedAt(plan.generatedAt)}
                </time>
              )}
            </div>
            <ul className="plan-keyword-chips" aria-label="本周关键词">
              {plan.targetBodyTypeLabel && (
                <li>{plan.targetBodyTypeLabel}</li>
              )}
              {plan.days?.length > 0 && (
                <li>
                  {plan.days.length} 练 · {totalExercises} 动作
                </li>
              )}
              {injurySummaryLabel && <li>减量 · {injurySummaryLabel}</li>}
              {postureSummaryLabel && <li>体态 · {postureSummaryLabel}</li>}
              {plan.bodyLoad?.bmi != null && <li>BMI {plan.bodyLoad.bmi}</li>}
              {plan.bodyLoad?.exercisesPerDay != null && (
                <li>每天约 {plan.bodyLoad.exercisesPerDay} 动作</li>
              )}
              {weekBurn?.kcal > 0 && <li>约 {weekBurn.kcal} 千卡</li>}
              {weekBurn?.foodLine && (
                <li className="plan-keyword-chip-soft">≈ {weekBurn.foodLine}</li>
              )}
            </ul>
            <button
              type="button"
              className="btn btn-ghost plan-detail-trigger"
              onClick={() => setDetailOpen(true)}
            >
              查看详情
            </button>
          </header>

          <WeeklyPlanOverview plan={plan} />

          <div className="plan-progress" aria-label="本周完成进度">
            <div className="plan-progress-meta">
              <span>本周已完成</span>
              <strong>
                {doneCount} / {totalExercises}
              </strong>
            </div>
            <div
              className="plan-progress-bar"
              role="progressbar"
              aria-valuenow={doneCount}
              aria-valuemin={0}
              aria-valuemax={totalExercises || 1}
            >
              <span
                style={{
                  width: `${totalExercises ? (doneCount / totalExercises) * 100 : 0}%`,
                }}
              />
            </div>
          </div>

          <div className="plan-days">
            {weekTimeline.map((row) => {
              if (row.isRest || !row.day) {
                return (
                  <article
                    key={`rest-${row.weekday}`}
                    className={[
                      'plan-day',
                      'plan-day-rest',
                      row.isToday ? 'is-today' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <header className="plan-day-header">
                      <h3>
                        <span className="plan-day-badge">{row.weekday}</span>
                        恢复
                        {row.isToday && (
                          <span className="plan-day-today">今天</span>
                        )}
                      </h3>
                    </header>
                    <p className="plan-day-rest-hint">睡眠 · 步行 · 拉伸</p>
                  </article>
                )
              }

              const day = row.day
              const dayBurn = describeDayBurn(day, profile.weight)
              const dayDone = (day.exercises || []).filter((ex) =>
                isExerciseCompleted(weekLog, day.dayIndex, ex.id),
              ).length
              return (
                <article
                  key={`${day.day}-${day.sessionCode || day.focus}`}
                  id={getDayAnchorId(day.dayIndex)}
                  className={[
                    'plan-day',
                    row.isToday ? 'is-today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <header className="plan-day-header">
                    <h3>
                      <span className="plan-day-badge">{day.day}</span>
                      {day.sessionTitle || `重点：${day.focus}`}
                      {row.isToday && (
                        <span className="plan-day-today">今天</span>
                      )}
                    </h3>
                    <p className="plan-day-muscles">
                      {day.sessionCode && (
                        <span className="plan-session-code">{day.sessionCode}</span>
                      )}
                      <span>{day.focus}</span>
                      {day.exercises?.length > 0 && (
                        <span>
                          · 已完成 {dayDone}/{day.exercises.length}
                        </span>
                      )}
                    </p>
                  </header>

                  <ul className="plan-exercise-list">
                    {day.exercises.map((ex) => {
                      const done = isExerciseCompleted(
                        weekLog,
                        day.dayIndex,
                        ex.id,
                      )
                      const thumb = resolveExerciseThumb(ex)
                      return (
                        <li
                          key={`${day.day}-${ex.id}`}
                          id={getExerciseAnchorId(day.dayIndex, ex.id)}
                          className={done ? 'is-done' : undefined}
                        >
                          <div className="plan-ex-top">
                            <label className="plan-ex-check">
                              <input
                                type="checkbox"
                                checked={done}
                                onChange={() => handleToggleDone(day, ex)}
                              />
                              <span>{done ? '已完成' : '标记完成'}</span>
                            </label>
                          </div>
                          {thumb ? (
                            <div className="plan-ex-video">
                              <a
                                href={ex.videoUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <img
                                  src={thumb}
                                  alt={ex.name}
                                  loading="lazy"
                                />
                                <span className="plan-ex-play">▶</span>
                              </a>
                              <div className="plan-ex-info">
                                <div className="plan-ex-main">
                                  <strong>{ex.name}</strong>
                                  <span className="plan-ex-sets">
                                    {ex.setsLabel}
                                  </span>
                                  {ex.role && (
                                    <span className="plan-ex-role">
                                      {ex.role === 'compound'
                                        ? '复合'
                                        : ex.role === 'isolation'
                                          ? '孤立'
                                          : '辅助'}
                                    </span>
                                  )}
                                </div>
                                <ExerciseCareBadges exercise={ex} />
                                {(ex.advice || ex.injuryTip || ex.postureTip) && (
                                  <details className="plan-ex-more">
                                    <summary>要点</summary>
                                    {ex.postureTip && (
                                      <p className="plan-ex-posture-tip">
                                        {ex.postureTip}
                                      </p>
                                    )}
                                    {ex.injuryTip && (
                                      <p className="plan-ex-injury-tip">
                                        {ex.injuryTip}
                                      </p>
                                    )}
                                    {ex.advice && (
                                      <p className="plan-ex-advice">
                                        {ex.advice}
                                      </p>
                                    )}
                                  </details>
                                )}
                                <div className="plan-ex-links">
                                  {ex.primaryMuscleId && (
                                    <Link to={`/muscle/${ex.primaryMuscleId}`}>
                                      {ex.primaryMuscleName || '肌肉详情'}
                                    </Link>
                                  )}
                                  <a
                                    href={ex.videoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    播放视频
                                  </a>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="plan-ex-main">
                                <strong>{ex.name}</strong>
                                <span className="plan-ex-sets">
                                  {ex.setsLabel}
                                </span>
                                {ex.role && (
                                  <span className="plan-ex-role">
                                    {ex.role === 'compound'
                                      ? '复合'
                                      : ex.role === 'isolation'
                                        ? '孤立'
                                        : '辅助'}
                                  </span>
                                )}
                              </div>
                              <ExerciseCareBadges exercise={ex} />
                              {(ex.advice || ex.injuryTip || ex.postureTip) && (
                                <details className="plan-ex-more">
                                  <summary>要点</summary>
                                  {ex.postureTip && (
                                    <p className="plan-ex-posture-tip">
                                      {ex.postureTip}
                                    </p>
                                  )}
                                  {ex.injuryTip && (
                                    <p className="plan-ex-injury-tip">
                                      {ex.injuryTip}
                                    </p>
                                  )}
                                  {ex.advice && (
                                    <p className="plan-ex-advice">{ex.advice}</p>
                                  )}
                                </details>
                              )}
                              <div className="plan-ex-links">
                                {ex.primaryMuscleId && (
                                  <Link to={`/muscle/${ex.primaryMuscleId}`}>
                                    {ex.primaryMuscleName || '肌肉详情'}
                                  </Link>
                                )}
                                <a
                                  href={ex.videoUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  教学视频
                                </a>
                              </div>
                            </>
                          )}
                        </li>
                      )
                    })}
                  </ul>

                  {day.stretches?.length > 0 && (
                    <section
                      className="plan-day-stretch"
                      aria-label={`${day.day}练后拉伸`}
                    >
                      <header className="plan-day-stretch-header">
                        <h4>练后拉伸</h4>
                        <span>各约 30 秒</span>
                      </header>
                      <ul className="plan-day-stretch-chips">
                        {day.stretches.map((item) => (
                          <li key={`${day.dayIndex}-${item.muscleId}`}>
                            {item.muscleName || item.position}
                          </li>
                        ))}
                      </ul>
                      <details className="plan-day-stretch-details">
                        <summary>拉伸做法</summary>
                        <ul className="plan-day-stretch-list">
                          {day.stretches.map((item) => {
                            const demoUrl = stretchVideoUrl(item)
                            return (
                              <li key={`${day.dayIndex}-${item.muscleId}-cue`}>
                                <div className="plan-day-stretch-top">
                                  <strong>{item.position}</strong>
                                  <span className="plan-day-stretch-hold">
                                    {item.holdSeconds || 30} 秒
                                  </span>
                                </div>
                                <p>{item.cue}</p>
                                {demoUrl && (
                                  <a
                                    href={demoUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    看演示
                                  </a>
                                )}
                              </li>
                            )
                          })}
                        </ul>
                      </details>
                    </section>
                  )}

                  {dayBurn.kcal > 0 && (
                    <footer className="plan-burn-day">
                      <div className="plan-burn-day-top">
                        <span className="plan-burn-label">练完这套约</span>
                        <strong>{dayBurn.kcal} 千卡</strong>
                        <span className="plan-burn-mins">
                          · 约 {dayBurn.minutes} 分钟
                        </span>
                      </div>
                      {dayBurn.foodLine && (
                        <p className="plan-burn-food">
                          大概相当于 <span>{dayBurn.foodLine}</span> 的热量
                          <span className="plan-burn-or-note">（任选一种对照）</span>
                        </p>
                      )}
                    </footer>
                  )}
                </article>
              )
            })}
          </div>

          <PlanDetailModal
            open={detailOpen}
            title="计划详情"
            onClose={() => setDetailOpen(false)}
          >
            {(plan.scienceNote || displayNote) && (
              <section className="plan-detail-section">
                <h4>计划说明</h4>
                {plan.scienceNote && <p>{plan.scienceNote}</p>}
                {displayNote && <p>{displayNote}</p>}
              </section>
            )}
            {(plan.injuryCare || plan.injuries?.length > 0) && (
              <section className="plan-detail-section">
                <h4>不适部位 · {injurySummaryLabel || '减量安排'}</h4>
                <p>
                  {plan.injuryCare?.summary ||
                    '相关动作会减重减次；尖锐痛、无力或不稳时停训。'}
                </p>
                <ul>
                  {(plan.injuryCare?.warnings?.length
                    ? plan.injuryCare.warnings
                    : plan.injuryCare?.notes || []
                  ).map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </section>
            )}
            {(plan.postureCare || plan.postures?.length > 0) && (
              <section className="plan-detail-section">
                <h4>体态问题 · {postureSummaryLabel || '矫正穿插'}</h4>
                <p>
                  {plan.postureCare?.summary ||
                    '训练中会穿插矫正动作并标注「改善体态」。'}
                </p>
                <ul>
                  {(plan.postureCare?.hints?.length
                    ? plan.postureCare.hints
                    : plan.postureCare?.notes || []
                  ).map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </section>
            )}
            {plan.bodyLoad && (
              <section className="plan-detail-section">
                <h4>身体档案 · {plan.bodyLoad.goalLabel}</h4>
                {plan.bodyLoad.summary && <p>{plan.bodyLoad.summary}</p>}
                {plan.bodyLoad.tips?.length > 0 && (
                  <ul>
                    {plan.bodyLoad.tips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                )}
              </section>
            )}
            {weekBurn?.kcal > 0 && (
              <section className="plan-detail-section">
                <h4>热量对照</h4>
                <p>
                  本周约 {weekBurn.kcal} 千卡
                  {weekBurn.foodLine ? `，大约相当于 ${weekBurn.foodLine}` : ''}
                  。按动作类型与组数估算
                  {weekBurn.usedDefaultWeight
                    ? '（未填体重时按 65 kg）'
                    : `（按你的 ${profile.weight} kg）`}
                  ，仅作体感参考。
                </p>
              </section>
            )}
            {plan.restDayHints?.length > 0 && (
              <section className="plan-detail-section">
                <h4>休息日建议</h4>
                <ul>
                  {plan.restDayHints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </section>
            )}
          </PlanDetailModal>
        </div>
      ) : (
        <div className="plan-empty">
          <p>尚未生成计划。</p>
          <p className="muted">
            点上方按钮即可根据当前档案排出一周课表；练完后勾选动作，以后都能回看。
          </p>
        </div>
      )}
      <section className="plan-history" aria-label="训练历史">
        <header className="plan-history-header">
          <div>
            <h2>训练记录</h2>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setHistoryOpen((v) => !v)}
          >
            {historyOpen ? '收起' : '展开'}
          </button>
        </header>

        {historyOpen && (
          <>
            {!weekLog?.completed?.length && pastWeeks.length === 0 ? (
              <p className="plan-history-empty">勾选完成后会出现在这里。</p>
            ) : (
              <div className="plan-history-list">
                {weekLog?.completed?.length > 0 && (
                  <article className="plan-history-week is-current">
                    <header>
                      <h3>
                        {weekLog.weekLabel}
                        <span className="plan-history-tag">本周进行中</span>
                      </h3>
                      <p>
                        自 {formatWeekRange(weekLog.startedAt)} · 已完成{' '}
                        {weekLog.completed.length} 个动作
                      </p>
                    </header>
                    <div className="plan-history-days">
                      {groupCompletedByDay(weekLog.completed).map(
                        ([dayName, items]) => (
                          <div key={dayName}>
                            <strong>{dayName}</strong>
                            <ul>
                              {items.map((item) => (
                                <li key={item.key}>
                                  {item.exerciseName}
                                  {item.setsLabel ? (
                                    <span> · {item.setsLabel}</span>
                                  ) : null}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ),
                      )}
                    </div>
                  </article>
                )}

                {pastWeeks.map((week) => {
                  const groups = groupCompletedByDay(week.completed)
                  return (
                    <article key={week.id} className="plan-history-week">
                      <header>
                        <h3>{week.weekLabel}</h3>
                        <p>
                          {formatWeekRange(week.startedAt)}
                          {week.closedAt
                            ? ` – ${formatWeekRange(week.closedAt)}`
                            : ''}
                          {' · '}
                          完成 {week.completed?.length || 0} 个动作
                        </p>
                      </header>

                      {groups.length > 0 ? (
                        <div className="plan-history-days">
                          {groups.map(([dayName, items]) => (
                            <div key={dayName}>
                              <strong>{dayName}</strong>
                              <ul>
                                {items.map((item) => (
                                  <li key={item.key}>
                                    {item.exerciseName}
                                    {item.setsLabel ? (
                                      <span> · {item.setsLabel}</span>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">该周没有勾选完成的动作。</p>
                      )}
                    </article>
                  )
                })}
              </div>
            )}
          </>
        )}
      </section>

      <FitnessCoach />

      <ExerciseCompletionModal
        open={exerciseRewardOpen}
        exerciseName={exerciseRewardName}
        message={exerciseRewardMessage}
        onClose={handleCloseExerciseReward}
      />
    </section>
  )
}
