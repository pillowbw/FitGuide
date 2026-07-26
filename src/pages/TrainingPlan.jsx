import { useState } from 'react'
import { Link } from 'react-router-dom'
import FitnessCoach from '../components/FitnessCoach'
import { generatePlan } from '../utils/planGenerator'
import { usePageReveal } from '../hooks/usePageReveal'
import {
  clearPlan,
  getPlan,
  getProfile,
  hasBasicProfile,
  hasPlanSource,
} from '../utils/storage'
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

/** 成员 C：个性化训练计划 */
export default function TrainingPlan() {
  const pageRef = usePageReveal()
  const [profile, setProfile] = useState(() => getProfile())
  const [plan, setPlan] = useState(() => getPlan())
  const [justGenerated, setJustGenerated] = useState(false)

  const missingBasics = !hasBasicProfile(profile)
  const missingSource = !hasPlanSource(profile)
  const nextPath = profile.path === 'advanced' ? '/anatomy' : '/beginner'
  const nextPathLabel =
    profile.path === 'advanced' ? '自选肌肉' : '新手推荐'

  function handleGenerate() {
    const latest = getProfile()
    setProfile(latest)
    const next = generatePlan(latest)
    setPlan(next)
    setJustGenerated(true)
  }

  function handleClear() {
    clearPlan()
    setPlan(null)
    setJustGenerated(false)
  }

  return (
    <section className="page plan-page" ref={pageRef}>
      <header className="plan-hero">
        <p className="eyebrow">Training Plan</p>
        <h1>个性化训练计划</h1>
        <p className="lede">
          按科学分化排课：业余 3 日全身轮换，进阶 4 日上/下肢 A·B。每天动作尽量不重复，覆盖不同发力模式。
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
          <span className="plan-summary-label">体型提示</span>
          <strong>{profile.currentBodyTypeId || '通用'}</strong>
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
          已生成并保存到本机 · {formatGeneratedAt(plan.generatedAt)}
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
              <p className="plan-note">{plan.note}</p>
            </div>
            {plan.generatedAt && (
              <time className="plan-time" dateTime={plan.generatedAt}>
                {formatGeneratedAt(plan.generatedAt)}
              </time>
            )}
          </header>

          <div className="plan-days">
            {plan.days.map((day) => (
              <article key={`${day.day}-${day.sessionCode || day.focus}`} className="plan-day">
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
                      <span>· {day.exercises.length} 个动作</span>
                    )}
                  </p>
                </header>

                <ul className="plan-exercise-list">
                  {day.exercises.map((ex) => (
                    <li key={`${day.day}-${ex.id}`}>
                      <div className="plan-ex-main">
                        <strong>{ex.name}</strong>
                        <span className="plan-ex-sets">{ex.setsLabel}</span>
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
                        <a href={ex.videoUrl} target="_blank" rel="noreferrer">
                          教学视频
                        </a>
                      </div>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
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
            点上方按钮即可根据当前档案排出一周课表；档案与目标越完整，安排越贴合。
          </p>
        </div>
      )}
      <FitnessCoach />
    </section>
  )
}
