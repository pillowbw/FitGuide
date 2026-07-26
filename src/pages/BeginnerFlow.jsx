import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import bodyTypes from '../data/bodyTypes.json'
import muscles from '../data/muscles.json'
import BodyTypePicker from '../components/BodyTypePicker'
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

/** 成员 A：业余路径——部位 + 目标身材 → 推荐肌肉 */
export default function BeginnerFlow() {
  const navigate = useNavigate()
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

  function saveCurrentSelection() {
    if (!targetBodyTypeId || recommended.length === 0) {
      return
    }

    saveProfile(buildProfilePatch())
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
    <section className="page beginner-page">
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

            return (
              <button
                key={region.id}
                type="button"
                className={`region-card${selected ? ' is-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => selectRegion(region.id)}
              >
                <strong>{region.label}</strong>
                <span>{region.description}</span>
              </button>
            )
          })}
        </div>
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
              点击肌肉名称，可以查看介绍和相关训练动作。
            </p>
          </div>
        </div>

        {recommended.length > 0 ? (
          <>
            <p className="recommendation-summary">
              根据你的选择，建议重点训练以下
              <strong> {recommended.length} </strong>
              个肌肉部位：
            </p>

            <ul className="recommended-muscle-grid">
              {recommended.map((muscle) => (
                <li key={muscle.id} className="recommended-muscle-card">
                  <div>
                    <Link
                      to={`/muscle/${muscle.id}`}
                      onClick={saveCurrentSelection}
                    >
                      {muscle.name}
                    </Link>
                    <p>{muscle.summary}</p>
                  </div>

                  <Link
                    className="muscle-detail-link"
                    to={`/muscle/${muscle.id}`}
                    onClick={saveCurrentSelection}
                  >
                    查看详情
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <div className="empty-recommendation">
            <strong>等待选择目标身材</strong>
            <p>选择上方的一张目标身材例图后，这里会显示推荐肌肉。</p>
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