import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import muscles from '../data/muscles.json'
import MuscleMap from '../components/MuscleMap'
import { saveProfile } from '../utils/storage'

/** 成员 B：进阶 — 正反肌肉解剖图 */
export default function AnatomyExplorer() {
  const [side, setSide] = useState('front')
  const navigate = useNavigate()

  function handleSelect(muscleId) {
    const profilePatch = {
      path: 'advanced',
      selectedMuscleIds: [muscleId],
    }
    saveProfile(profilePatch)
    navigate(`/muscle/${muscleId}`)
  }

  return (
    <section className="page">
      <h1>人体肌肉解剖图</h1>
      <p className="lede">点击肌肉查看介绍与教学动作。可切换正反面。</p>

      <div className="chip-row">
        <button
          type="button"
          className={`chip${side === 'front' ? ' is-selected' : ''}`}
          onClick={() => setSide('front')}
        >
          正面
        </button>
        <button
          type="button"
          className={`chip${side === 'back' ? ' is-selected' : ''}`}
          onClick={() => setSide('back')}
        >
          背面
        </button>
      </div>

      <MuscleMap side={side} muscles={muscles} onSelect={handleSelect} />

      <p className="owner-note">
        负责人：成员 B — 请将 MuscleMap 替换为可点击 SVG / 热区图
      </p>
    </section>
  )
}
