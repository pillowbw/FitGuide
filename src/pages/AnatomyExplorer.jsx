import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import muscles from '../data/muscles.json'
import MuscleMap from '../components/MuscleMap'
import { getProfile, saveProfile } from '../utils/storage'

/** 成员 B：进阶 — 正反肌肉解剖图 */
export default function AnatomyExplorer() {
  const [side, setSide] = useState('front')
  const navigate = useNavigate()
  const selectedCount = getProfile().selectedMuscleIds?.length || 0

  function handleSelect(muscleId) {
    const profile = getProfile()
    const selected = new Set(profile.selectedMuscleIds || [])
    selected.add(muscleId)
    saveProfile({
      path: 'advanced',
      selectedMuscleIds: [...selected],
    })
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

      <div className="cta-row">
        <Link className="btn btn-primary" to="/plan">
          {selectedCount > 0
            ? `生成计划（已选 ${selectedCount} 块肌）`
            : '生成个性化计划'}
        </Link>
      </div>
    </section>
  )
}
