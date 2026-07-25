import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import bodyTypes from '../data/bodyTypes.json'
import muscles from '../data/muscles.json'
import BodyTypePicker from '../components/BodyTypePicker'
import { saveProfile } from '../utils/storage'

const REGIONS = [
  { id: 'upper', label: '上肢' },
  { id: 'core', label: '核心' },
  { id: 'lower', label: '下肢' },
  { id: 'full', label: '全身' },
]

/** 成员 A：业余路径 — 部位 + 目标身材 → 推荐肌肉 */
export default function BeginnerFlow() {
  const targetTypes = useMemo(
    () => bodyTypes.filter((t) => t.kind === 'target'),
    [],
  )
  const [goalRegion, setGoalRegion] = useState('upper')
  const [targetBodyTypeId, setTargetBodyTypeId] = useState('')

  const recommended = useMemo(() => {
    const target = targetTypes.find((t) => t.id === targetBodyTypeId)
    let ids = target?.recommendedMuscleIds || []
    if (goalRegion !== 'full') {
      ids = ids.filter((id) => {
        const m = muscles.find((x) => x.id === id)
        return m?.region === goalRegion
      })
      if (!ids.length) {
        ids = muscles.filter((m) => m.region === goalRegion).map((m) => m.id)
      }
    }
    return muscles.filter((m) => ids.includes(m.id))
  }, [goalRegion, targetBodyTypeId, targetTypes])

  function persist() {
    saveProfile({
      path: 'beginner',
      goalRegion,
      targetBodyTypeId,
      selectedMuscleIds: recommended.map((m) => m.id),
    })
  }

  return (
    <section className="page">
      <h1>选择想练的大致部位</h1>
      <div className="chip-row">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`chip${goalRegion === r.id ? ' is-selected' : ''}`}
            onClick={() => setGoalRegion(r.id)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <h2>想练成的身材</h2>
      <BodyTypePicker
        types={targetTypes}
        value={targetBodyTypeId}
        onChange={setTargetBodyTypeId}
      />

      <h2>推荐训练的肌肉</h2>
      {recommended.length ? (
        <ul className="simple-list">
          {recommended.map((m) => (
            <li key={m.id}>
              <Link to={`/muscle/${m.id}`}>{m.name}</Link>
              <span>{m.summary}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">请先选择目标身材，或换一个部位。</p>
      )}

      <div className="cta-row">
        <Link className="btn btn-primary" to="/plan" onClick={persist}>
          生成个性化计划
        </Link>
      </div>

      <p className="owner-note">负责人：成员 A</p>
    </section>
  )
}
