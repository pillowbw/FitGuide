import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import muscles from '../data/muscles.json'
import exercises from '../data/exercises.json'
import MuscleMap from '../components/MuscleMap'
import { usePageReveal } from '../hooks/usePageReveal'
import { getProfile, saveProfile } from '../utils/storage'
import { getThumb } from '../utils/videoMap'

/** 成员 B：进阶 — 正反肌肉解剖图 + 动作选择 */
export default function AnatomyExplorer() {
  const navigate = useNavigate()
  const pageRef = usePageReveal()
  const [selectedMuscleIds, setSelectedMuscleIds] = useState(
    () => getProfile().selectedMuscleIds || [],
  )
  const [selectedExercises, setSelectedExercises] = useState(
    () => getProfile().selectedExerciseIds || [],
  )

  function handleMuscleClick(muscleId) {
    const profile = getProfile()
    const selected = new Set(profile.selectedMuscleIds || [])
    if (selected.has(muscleId)) {
      selected.delete(muscleId)
    } else {
      selected.add(muscleId)
    }
    const next = [...selected]
    setSelectedMuscleIds(next)
    saveProfile({ path: 'advanced', selectedMuscleIds: next })
  }

  function toggleExercise(exId) {
    setSelectedExercises((prev) =>
      prev.includes(exId) ? prev.filter((id) => id !== exId) : [...prev, exId],
    )
  }

  const availableExercises = useMemo(() => {
    if (selectedMuscleIds.length === 0) return []
    return exercises.filter((ex) =>
      ex.muscleIds.some((id) => selectedMuscleIds.includes(id)),
    )
  }, [selectedMuscleIds])

  function handleAddToPlan() {
    saveProfile({
      path: 'advanced',
      selectedMuscleIds,
      selectedExerciseIds: selectedExercises,
    })
    navigate('/plan')
  }

  return (
    <section className="page" ref={pageRef}>
      <h1>自选肌肉</h1>
      <p className="lede">
        在人体解剖图上点选目标肌肉，再从下方挑选训练动作，最后生成计划。
      </p>

      <MuscleMap
        muscles={muscles}
        selectedIds={selectedMuscleIds}
        onSelect={handleMuscleClick}
      />

      {selectedMuscleIds.length > 0 && (
        <div className="selected-muscles-chips">
          {selectedMuscleIds.map((id) => {
            const m = muscles.find((x) => x.id === id)
            if (!m) return null
            return (
              <Link key={id} className="chip is-selected" to={`/muscle/${id}`}>
                {m.name}
              </Link>
            )
          })}
        </div>
      )}

      {selectedMuscleIds.length > 0 && (
        <div className="exercise-selector">
          <h2 className="section-heading">
            选择训练动作
            <span className="section-count">{availableExercises.length}</span>
          </h2>

          <div className="exercise-grid">
            {availableExercises.map((ex) => (
              <ExerciseCard
                key={ex.id}
                exercise={ex}
                thumb={getThumb(ex.id, ex.name, ex.videoUrl)}
                isSelected={selectedExercises.includes(ex.id)}
                onToggle={() => toggleExercise(ex.id)}
              />
            ))}
          </div>

          {selectedExercises.length > 0 && (
            <div className="cta-row">
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddToPlan}
              >
                加入训练计划 ({selectedExercises.length})
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setSelectedExercises([])}
              >
                清空选择
              </button>
            </div>
          )}
        </div>
      )}

      <div className="cta-row">
        <Link className="btn btn-primary" to="/plan">
          {selectedMuscleIds.length > 0
            ? `生成计划（已选 ${selectedMuscleIds.length} 块肌）`
            : '生成个性化计划'}
        </Link>
      </div>
    </section>
  )
}

function ExerciseCard({ exercise, thumb, isSelected, onToggle }) {
  return (
    <button
      type="button"
      className={`exercise-card${isSelected ? ' is-selected' : ''}`}
      onClick={onToggle}
    >
      <div className="exercise-card-img">
        {thumb ? (
          <img src={thumb} alt={exercise.name} loading="lazy" />
        ) : (
          <div className="exercise-card-placeholder" />
        )}
        {isSelected && <span className="exercise-card-check">✓</span>}
      </div>
      <div className="exercise-card-body">
        <strong className="exercise-card-name">{exercise.name}</strong>
        <p className="exercise-card-advice">{exercise.advice}</p>
        <span className={`exercise-level level-${exercise.level}`}>
          {exercise.level === 'beginner' ? '入门' : '进阶'}
        </span>
      </div>
    </button>
  )
}
