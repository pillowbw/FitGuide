import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import bodyTypes from '../data/bodyTypes.json'
import muscles from '../data/muscles.json'
import BodyTypePicker from '../components/BodyTypePicker'
import MuscleMap from '../components/MuscleMap'
import { usePageReveal } from '../hooks/usePageReveal'
import {
  getRegionInjuryWarnings,
  injuryLabelsText,
} from '../utils/injurySafety'
import {
  getRegionPostureHints,
  postureLabelsText,
} from '../utils/postureSafety'
import { getProfile, saveProfile } from '../utils/storage'

const REGIONS = [
  {
    id: 'upper',
    label: '上肢',
    description: '胸部、肩部、背部和手臂',
  },
  {
    id: 'core',
    label: '核心',
    description: '腹部和躯干稳定能力',
  },
  {
    id: 'lower',
    label: '下肢',
    description: '臀部、大腿和小腿',
  },
  {
    id: 'full',
    label: '全身',
    description: '均衡训练多个身体部位',
  },
]

/** 成员 A：新手推荐——部位 + 目标身材 → 解剖图高亮推荐肌肉 */
export default function BeginnerFlow() {
  const navigate = useNavigate()
  const pageRef = usePageReveal()
  const [existing] = useState(getProfile)

  const targetTypes = useMemo(
    () => bodyTypes.filter((type) => type.kind === 'target'),
    [],
  )

  const validRegions = REGIONS.map((region) => region.id)

  const [goalRegion, setGoalRegion] = useState(
    validRegions.includes(existing.goalRegion)
      ? existing.goalRegion
      : 'upper',
  )

  const [targetBodyTypeId, setTargetBodyTypeId] = useState(
    existing.targetBodyTypeId || '',
  )

  const [message, setMessage] = useState('')

  const availableTargetTypes = useMemo(() => {
    if (goalRegion === 'full') {
      return targetTypes
    }

    return targetTypes.filter((type) => {
      if (!Array.isArray(type.recommendedRegions)) {
        return true
      }

      return type.recommendedRegions.includes(goalRegion)
    })
  }, [goalRegion, targetTypes])

  const recommended = useMemo(() => {
    const selectedTarget = availableTargetTypes.find(
      (type) => type.id === targetBodyTypeId,
    )

    if (!selectedTarget) {
      return []
    }

    let ids = selectedTarget.recommendedMuscleIds || []

    if (goalRegion !== 'full') {
      ids = ids.filter((id) => {
        const muscle = muscles.find((item) => item.id === id)
        return muscle?.region === goalRegion
      })
    }

    return ids
      .map((id) => muscles.find((muscle) => muscle.id === id))
      .filter(Boolean)
  }, [availableTargetTypes, goalRegion, targetBodyTypeId])

  function selectRegion(regionId) {
    setGoalRegion(regionId)
    setMessage('')

    const selectedTarget = targetTypes.find(
      (type) => type.id === targetBodyTypeId,
    )

    if (
      selectedTarget &&
      regionId !== 'full' &&
      Array.isArray(selectedTarget.recommendedRegions) &&
      !selectedTarget.recommendedRegions.includes(regionId)
    ) {
      setTargetBodyTypeId('')
    }
  }

  function selectTarget(targetId) {
    setTargetBodyTypeId(targetId)
    setMessage('')
  }

  function buildProfilePatch() {
    return {
      path: 'beginner',
      goalRegion,
      targetBodyTypeId,
      selectedMuscleIds: recommended.map((muscle) => muscle.id),
    }
  }

  const recommendedIds = useMemo(
    () => recommended.map((muscle) => muscle.id),
    [recommended],
  )

  const injuryWarnings = useMemo(
    () => getRegionInjuryWarnings(existing.injuries, goalRegion),
    [existing.injuries, goalRegion],
  )

  const injuryLabelText = useMemo(
    () => injuryLabelsText(existing.injuries),
    [existing.injuries],
  )

  const postureHints = useMemo(
    () => getRegionPostureHints(existing.postures, goalRegion),
    [existing.postures, goalRegion],
  )

  const postureLabelText = useMemo(
    () => postureLabelsText(existing.postures),
    [existing.postures],
  )

  function saveCurrentSelection() {
    if (!targetBodyTypeId || recommended.length === 0) {
      return
    }

    saveProfile(buildProfilePatch())
  }

  function openRecommendedMuscle(muscleId) {
    if (!recommendedIds.includes(muscleId)) return
    saveCurrentSelection()
    navigate(`/muscle/${muscleId}`)
  }

  function generatePlan() {
    if (!targetBodyTypeId) {
      setMessage('请先选择一个目标身材。')
      return
    }

    if (recommended.length === 0) {
      setMessage('当前选择没有找到合适的肌肉，请更换部位或目标身材。')
      return
    }

    saveProfile(buildProfilePatch())
    navigate('/plan')
  }

  return (
    <section className="page beginner-page" ref={pageRef}>
      <div>
        <p className="eyebrow">第 2 步 · 选择训练目标</p>
        <h1>你大概想练哪个部位？</h1>
        <p className="lede">
          不需要知道专业的肌肉名称，只需选择身体部位和目标身材，
          FitGuide会为你推荐应该重点训练的肌肉。
        </p>
      </div>

      <section className="beginner-section" aria-labelledby="region-title">
        <div className="section-heading">
          <span className="step-number">1</span>
          <div>
            <h2 id="region-title">选择训练部位</h2>
            <p className="muted">选择你目前最想改善的身体区域。</p>
          </div>
        </div>

        <div className="region-grid">
          {REGIONS.map((region) => {
            const selected = goalRegion === region.id
            const risk = getRegionInjuryWarnings(
              existing.injuries,
              region.id,
            ).length
            const posture = getRegionPostureHints(
              existing.postures,
              region.id,
            ).length

            return (
              <button
                key={region.id}
                type="button"
                className={`region-card${selected ? ' is-selected' : ''}${risk ? ' has-injury-risk' : ''}${posture ? ' has-posture-hint' : ''}`}
                aria-pressed={selected}
                onClick={() => selectRegion(region.id)}
              >
                <strong>{region.label}</strong>
                <span>{region.description}</span>
                {risk > 0 && (
                  <em className="region-injury-tag">可练 · 减量</em>
                )}
                {posture > 0 && (
                  <em className="region-posture-tag">含体态矫正</em>
                )}
              </button>
            )
          })}
        </div>

        {injuryWarnings.length > 0 && (
          <aside className="injury-callout" role="status">
            <strong>
              训练怎么安排
              {injuryLabelText ? `（${injuryLabelText}）` : ''}
            </strong>
            {injuryWarnings.map((item) => (
              <div key={item.id} className="injury-callout-block">
                <p>{item.warning}</p>
                {item.expectedSensation && (
                  <p className="injury-callout-expected">
                    常见感受：{item.expectedSensation}
                  </p>
                )}
                {item.loadGuidance && (
                  <p className="injury-callout-focus">{item.loadGuidance}</p>
                )}
              </div>
            ))}
            <p className="injury-callout-focus">
              生成计划时会在相关动作上自动减重减次
              {injuryWarnings[0]?.safeFocus
                ? ` · ${injuryWarnings[0].safeFocus}`
                : ''}
              。
            </p>
            <Link className="injury-callout-link" to="/profile">
              修改不适部位
            </Link>
          </aside>
        )}

        {postureHints.length > 0 && (
          <aside className="injury-callout posture-callout" role="status">
            <strong>
              体态矫正怎么穿插
              {postureLabelText ? `（${postureLabelText}）` : ''}
            </strong>
            {postureHints.map((item) => (
              <div key={item.id} className="injury-callout-block">
                <p>{item.hint}</p>
                {item.safeFocus && (
                  <p className="injury-callout-focus">{item.safeFocus}</p>
                )}
              </div>
            ))}
            <p className="injury-callout-focus">
              生成计划时会在训练中穿插矫正动作，并标注「改善体态」。
            </p>
            <Link className="injury-callout-link" to="/profile">
              修改体态问题
            </Link>
          </aside>
        )}
      </section>

      <section className="beginner-section" aria-labelledby="target-title">
        <div className="section-heading">
          <span className="step-number">2</span>
          <div>
            <h2 id="target-title">选择想练成的身材</h2>
            <p className="muted">
              页面只会显示适合当前训练部位的目标身材。
            </p>
          </div>
        </div>

        <BodyTypePicker
          types={availableTargetTypes}
          value={targetBodyTypeId}
          onChange={selectTarget}
        />
      </section>

      <section
        className="beginner-section recommendation-panel"
        aria-labelledby="recommendation-title"
      >
        <div className="section-heading">
          <span className="step-number">3</span>
          <div>
            <h2 id="recommendation-title">推荐训练的肌肉</h2>
            <p className="muted">
              下方解剖图会高亮推荐肌肉；只能点击高亮部位查看详情，其他肌肉不可选。
            </p>
          </div>
        </div>

        {recommended.length > 0 ? (
          <>
            <p className="recommendation-summary">
              根据你的选择，建议重点训练以下
              <strong> {recommended.length} </strong>
              个肌肉部位（已在图中高亮）：
            </p>

            <MuscleMap
              muscles={muscles}
              selectedIds={recommendedIds}
              interactiveIds={recommendedIds}
              onSelect={openRecommendedMuscle}
            />
          </>
        ) : (
          <div className="empty-recommendation">
            <strong>等待选择目标身材</strong>
            <p>选择上方的一张目标身材例图后，这里会用解剖图高亮推荐肌肉。</p>
          </div>
        )}
      </section>

      {message && (
        <p className="form-status form-status-error" role="alert">
          {message}
        </p>
      )}

      <div className="cta-row beginner-actions">
        <Link className="btn btn-ghost" to="/profile">
          返回修改档案
        </Link>

        <button
          type="button"
          className="btn btn-primary"
          onClick={generatePlan}
        >
          生成个性化计划
        </button>
      </div>
    </section>
  )
}