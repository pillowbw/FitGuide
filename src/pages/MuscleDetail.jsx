import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import muscles from '../data/muscles.json'
import exercises from '../data/exercises.json'
import VideoList from '../components/VideoList'
import { getProfile, saveProfile } from '../utils/storage'

/** 成员 B：单块肌肉介绍 + 视频 */
export default function MuscleDetail() {
  const { id } = useParams()
  const muscle = muscles.find((m) => m.id === id)
  const related = exercises.filter((ex) => ex.muscleIds.includes(id))
  const [added, setAdded] = useState(false)

  if (!muscle) {
    return (
      <section className="page">
        <h1>未找到该肌肉</h1>
        <Link to="/anatomy">返回解剖图</Link>
      </section>
    )
  }

  const profile = getProfile()
  const isAlreadyAdded = (profile.selectedMuscleIds || []).includes(muscle.id)

  function addToPlan() {
    const current = getProfile()
    const selected = new Set(current.selectedMuscleIds || [])
    selected.add(muscle.id)
    saveProfile({ selectedMuscleIds: [...selected] })
    setAdded(true)
    setTimeout(() => setAdded(false), 2000)
  }

  const regionLabel = { upper: '上肢', core: '核心', lower: '下肢' }[muscle.region] || muscle.region
  const sideLabel = { front: '正面', back: '背面' }[muscle.side] || muscle.side

  return (
    <section className="page">
      {/* 顶部元信息 */}
      <div className="muscle-meta">
        <span className="muscle-badge">{regionLabel}</span>
        <span className="muscle-badge">{sideLabel}</span>
      </div>

      <h1 className="muscle-title">{muscle.name}</h1>
      <p className="muscle-summary">{muscle.summary}</p>

      {/* 训练建议 */}
      <div className="muscle-section">
        <h2 className="section-heading">训练要点</h2>
        <ul className="tips-list">
          {muscle.tips.map((tip, i) => (
            <li key={i} className="tip-item">
              <span className="tip-bullet" aria-hidden="true" />
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* 相关动作与视频 */}
      <div className="muscle-section">
        <h2 className="section-heading">
          相关动作
          <span className="section-count">{related.length}</span>
        </h2>
        <VideoList exercises={related} />
      </div>

      {/* 操作按钮 */}
      <div className="cta-row">
        {isAlreadyAdded || added ? (
          <button type="button" className="btn btn-secondary" disabled>
            ✓ 已加入计划目标
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={addToPlan}>
            + 加入我的计划目标
          </button>
        )}
        <Link className="btn btn-primary" to="/plan">
          查看 / 生成计划
        </Link>
        <Link className="btn btn-ghost" to="/anatomy">
          返回解剖图
        </Link>
      </div>
    </section>
  )
}
