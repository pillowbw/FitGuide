import { Link, useNavigate } from 'react-router-dom'
import muscles from '../data/muscles.json'
import MuscleMap from '../components/MuscleMap'
import { usePageReveal } from '../hooks/usePageReveal'
import { getProfile, saveProfile } from '../utils/storage'

/** 成员 B：进阶 — 正反肌肉解剖图 */
export default function AnatomyExplorer() {
  const navigate = useNavigate()
  const pageRef = usePageReveal()
  const selectedIds = getProfile().selectedMuscleIds || []
  const selectedCount = selectedIds.length

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
    <section className="page" ref={pageRef}>
      <h1>自选肌肉</h1>
      <p className="lede">
        在人体解剖图上直接点选目标肌肉，查看介绍与教学动作。
      </p>

      <MuscleMap
        muscles={muscles}
        selectedIds={selectedIds}
        onSelect={handleSelect}
      />

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
