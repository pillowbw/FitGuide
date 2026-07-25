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

  if (!muscle) {
    return (
      <section className="page">
        <h1>未找到该肌肉</h1>
        <Link to="/anatomy">返回解剖图</Link>
      </section>
    )
  }

  function addToPlan() {
    const profile = getProfile()
    const selected = new Set(profile.selectedMuscleIds || [])
    selected.add(muscle.id)
    saveProfile({ selectedMuscleIds: [...selected] })
  }

  return (
    <section className="page">
      <p className="eyebrow">{muscle.region} · {muscle.side}</p>
      <h1>{muscle.name}</h1>
      <p className="lede">{muscle.summary}</p>

      <h2>训练建议</h2>
      <ul className="simple-list">
        {muscle.tips.map((tip) => (
          <li key={tip}>{tip}</li>
        ))}
      </ul>

      <h2>教学动作与视频</h2>
      <VideoList exercises={related} />

      <div className="cta-row">
        <button type="button" className="btn btn-secondary" onClick={addToPlan}>
          加入我的计划目标
        </button>
        <Link className="btn btn-primary" to="/plan" onClick={addToPlan}>
          查看 / 生成计划
        </Link>
        <Link className="btn btn-ghost" to="/anatomy">
          返回解剖图
        </Link>
      </div>

      <p className="owner-note">负责人：成员 B</p>
    </section>
  )
}
