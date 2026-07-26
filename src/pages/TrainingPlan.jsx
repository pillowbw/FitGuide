import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import FitnessCoach from '../components/FitnessCoach'
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
} from '../utils/storage'
import { youtubeThumbFromUrl } from '../utils/videoMap'
import './TrainingPlan.css'

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

function groupCompletedByDay(completed) {
  const map = new Map()
  for (const item of completed || []) {
    const key = item.day || `第 ${item.dayIndex} 天`
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return [...map.entries()]
}

/** 成员 C：个性化训练计划 */
export default function TrainingPlan() {
  const pageRef = usePageReveal()
  const [profile, setProfile] = useState(() => getProfile())
  const [plan, setPlan] = useState(() => getPlan())
  const [justGenerated, setJustGenerated] = useState(false)
  const [weekLog, setWeekLog] = useState(null)
  const [pastWeeks, setPastWeeks] = useState(() => getPastWeekLogs(6))
  const [historyOpen, setHistoryOpen] = useState(true)
  const [syncedFromProfile, setSyncedFromProfile] = useState(false)

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

  const totalExercises = useMemo(
    () =>
      plan?.days?.reduce((sum, day) => sum + (day.exercises?.length || 0), 0) ||
      0,
    [plan],
  )
  const doneCount = weekLog?.completed?.length || 0

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
    refreshHistoryViews(ensureCurrentWeekLog(next))
  }

  function handleClear() {
    clearPlan()
    setPlan(null)
    setJustGenerated(false)
    setWeekLog(null)
    setPastWeeks(getPastWeekLogs(6))
  }

  function handleToggleDone(day, exercise) {
    if (!plan) return
    const { week } = toggleExerciseCompleted(plan, day, exercise)
    refreshHistoryViews(week)
  }

  return (
    <section className="page plan-page" ref={pageRef}>
      <header className="plan-hero">
        <p className="eyebrow">Training Plan</p>
        <h1>个性化训练计划</h1>
        <p className="lede">
          勾选做过的动作会记在本机；下方可回看前几周练过什么。
        </p>
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
            <div>
              <h2>{plan.weekLabel}</h2>
              {plan.scienceNote && (
                <p className="plan-science">{plan.scienceNote}</p>
              )}
              {displayNote && <p className="plan-note">{displayNote}</p>}
            </div>
            {plan.generatedAt && (
              <time className="plan-time" dateTime={plan.generatedAt}>
                {formatGeneratedAt(plan.generatedAt)}
              </time>
            )}
          </header>

          {plan.bodyLoad && (
            <aside className="plan-body-load" aria-label="根据身体档案的运动量建议">
              <div className="plan-body-load-top">
                <span className="plan-burn-label">根据你的身体档案</span>
                <strong className="plan-body-load-goal">
                  {plan.bodyLoad.goalLabel}
                </strong>
              </div>
              <p className="plan-body-load-summary">{plan.bodyLoad.summary}</p>
              <ul className="plan-body-load-meta">
                {plan.bodyLoad.bmi != null && (
                  <li>BMI {plan.bodyLoad.bmi}</li>
                )}
                {plan.bodyLoad.bodyFat != null && (
                  <li>体脂 {plan.bodyLoad.bodyFat}%</li>
                )}
                {plan.bodyLoad.exercisesPerDay != null && (
                  <li>建议每天约 {plan.bodyLoad.exercisesPerDay} 个动作</li>
                )}
              </ul>
              {plan.bodyLoad.tips?.length > 0 && (
                <ul className="plan-body-load-tips">
                  {plan.bodyLoad.tips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              )}
            </aside>
          )}

          {weekBurn && weekBurn.kcal > 0 && (
            <aside className="plan-burn-week" aria-label="本周热量对照">
              <div className="plan-burn-week-main">
                <span className="plan-burn-label">练完本周约消耗</span>
                <strong className="plan-burn-kcal">{weekBurn.kcal} 千卡</strong>
              </div>
              {weekBurn.foodLine && (
                <p className="plan-burn-food">
                  大约相当于 <span>{weekBurn.foodLine}</span>
                  <span className="plan-burn-or-note">（任选一种对照）</span>
                </p>
              )}
              <p className="plan-burn-hint">
                按动作类型与组数估算
                {weekBurn.usedDefaultWeight
                  ? '（未填体重时按 65 kg）'
                  : `（按你的 ${profile.weight} kg）`}
                ，强度不同会有偏差，用来建立体感就好。
              </p>
            </aside>
          )}

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
            {plan.days.map((day) => {
              const dayBurn = describeDayBurn(day, profile.weight)
              const dayDone = (day.exercises || []).filter((ex) =>
                isExerciseCompleted(weekLog, day.dayIndex, ex.id),
              ).length
              return (
                <article
                  key={`${day.day}-${day.sessionCode || day.focus}`}
                  className="plan-day"
                >
                  <header className="plan-day-header">
                    <h3>
                      <span className="plan-day-badge">{day.day}</span>
                      {day.sessionTitle || `重点：${day.focus}`}
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
                                {ex.advice && (
                                  <p className="plan-ex-advice">{ex.advice}</p>
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
                              {ex.advice && (
                                <p className="plan-ex-advice">{ex.advice}</p>
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

          <aside className="plan-rest">
            <h3>休息日建议</h3>
            <ul>
              {plan.restDayHints.map((hint) => (
                <li key={hint}>{hint}</li>
              ))}
            </ul>
          </aside>
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
            <p className="muted">
              保存你勾选过的动作，可查看前几周练了什么（存在本机浏览器）。
            </p>
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
              <p className="plan-history-empty">
                还没有记录。在上方课表勾选「标记完成」后，本周与往期都会出现在这里。
              </p>
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
    </section>
  )
}
