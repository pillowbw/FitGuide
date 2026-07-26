import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import muscles from '../data/muscles.json'
import exercises from '../data/exercises.json'
import MuscleMap from '../components/MuscleMap'
import { usePageReveal } from '../hooks/usePageReveal'
import { getProfile, saveProfile } from '../utils/storage'
import { getThumb } from '../utils/videoMap'

const EQUIPMENT_ORDER = ['哑铃', '杠铃', '器械', '自重', '壶铃', '弹力带', 'TRX', '其他']

/** 难度从易到难：入门 → 进阶 */
const LEVEL_ORDER = { beginner: 0, intermediate: 1, advanced: 2 }

function sortByDifficulty(list) {
  return [...list].sort((a, b) => {
    const diff =
      (LEVEL_ORDER[a.level] ?? 99) - (LEVEL_ORDER[b.level] ?? 99)
    if (diff !== 0) return diff
    return a.name.localeCompare(b.name, 'zh')
  })
}

/** 成员 B：进阶 — 正反肌肉解剖图 + 动作选择（按器材分组） */
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

  const groupedExercises = useMemo(() => {
    if (selectedMuscleIds.length === 0) return []
    const filtered = exercises.filter((ex) =>
      ex.muscleIds.some((id) => selectedMuscleIds.includes(id)),
    )
    const groups = {}
    for (const ex of filtered) {
      const eq = ex.equipment || '其他'
      if (!groups[eq]) groups[eq] = []
      groups[eq].push(ex)
    }
    const ordered = []
    for (const eq of EQUIPMENT_ORDER) {
      if (groups[eq]) {
        ordered.push({
          equipment: eq,
          exercises: sortByDifficulty(groups[eq]),
        })
        delete groups[eq]
      }
    }
    for (const eq of Object.keys(groups).sort()) {
      ordered.push({
        equipment: eq,
        exercises: sortByDifficulty(groups[eq]),
      })
    }
    return ordered
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
            <span className="section-count">
              {groupedExercises.reduce((s, g) => s + g.exercises.length, 0)}
            </span>
          </h2>

          {groupedExercises.map(({ equipment, exercises: groupExs }) => (
            <div key={equipment} className="exercise-group">
              <h3 className="exercise-group-title">
                {equipment}
                <span className="exercise-group-count">{groupExs.length}</span>
              </h3>
              <div className="exercise-grid">
                {groupExs.map((ex) => (
                  <ExerciseCard
                    key={ex.id}
                    exercise={ex}
                    thumb={getThumb(ex.id, ex.name, ex.videoUrl)}
                    isSelected={selectedExercises.includes(ex.id)}
                    onToggle={() => toggleExercise(ex.id)}
                  />
                ))}
              </div>
            </div>
          ))}

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
  const REGION_COLORS = {
    upper: '#5fa8d3',
    core: '#62a86c',
    lower: '#d4906a',
  }

  const primaryMuscle = exercise.muscleIds?.[0]
    ? muscles.find((m) => m.id === exercise.muscleIds[0])
    : null
  const primaryRegion = ['upper', 'core', 'lower'].includes(primaryMuscle?.region)
    ? primaryMuscle.region
    : 'upper'
  const accentColor = REGION_COLORS[primaryRegion] || '#5fa8d3'

  return (
    <button
      type="button"
      className={`exercise-card${isSelected ? ' is-selected' : ''}`}
      onClick={onToggle}
    >
      <div className="exercise-card-img">
        {thumb ? (
          <img
            src={thumb}
            alt={exercise.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : null}
        {!thumb && (
          <div
            className="exercise-card-placeholder"
            style={{
              background: `linear-gradient(135deg, ${accentColor}22, ${accentColor}44)`,
            }}
          >
            <svg viewBox="0 0 60 60" className="exercise-placeholder-icon">
              <circle cx="30" cy="20" r="10" fill={accentColor} opacity="0.7" />
              <rect
                x="22"
                y="30"
                width="16"
                height="20"
                rx="4"
                fill={accentColor}
                opacity="0.5"
              />
              <rect
                x="14"
                y="32"
                width="8"
                height="14"
                rx="3"
                fill={accentColor}
                opacity="0.4"
              />
              <rect
                x="38"
                y="32"
                width="8"
                height="14"
                rx="3"
                fill={accentColor}
                opacity="0.4"
              />
              <rect
                x="24"
                y="50"
                width="5"
                height="10"
                rx="2"
                fill={accentColor}
                opacity="0.35"
              />
              <rect
                x="31"
                y="50"
                width="5"
                height="10"
                rx="2"
                fill={accentColor}
                opacity="0.35"
              />
            </svg>
            <span className="exercise-placeholder-label">{exercise.name}</span>
          </div>
        )}
        {isSelected && <span className="exercise-card-check">✓</span>}
      </div>
      <div className="exercise-card-body">
        <strong className="exercise-card-name">{exercise.name}</strong>
        <p className="exercise-card-advice">{exercise.advice}</p>
        <div className="exercise-card-meta">
          <span className={`exercise-level level-${exercise.level}`}>
            {exercise.level === 'beginner' ? '入门' : '进阶'}
          </span>
          {exercise.equipment && (
            <span className="exercise-equipment">{exercise.equipment}</span>
          )}
        </div>
      </div>
    </button>
  )
}
