import { useState } from 'react'
import { MuscleIllustration } from './body/MuscleIllustration'

/**
 * 正反面一体人体肌肉图（来自 Workout.cool，MIT）
 * props:
 * - muscles: muscles.json 数组
 * - selectedIds: 已选肌肉 id 列表
 * - onSelect: (muscleId) => void
 */
export default function MuscleMap({ muscles = [], selectedIds = [], onSelect }) {
  const [hovered, setHovered] = useState(null)

  const muscleNames = muscles.reduce((acc, m) => {
    acc[m.id] = m.name
    return acc
  }, {})

  function handleSelect(muscleId) {
    onSelect?.(muscleId)
  }

  return (
    <div className="muscle-map">
      {hovered && (
        <div className="muscle-map-tooltip">
          {muscleNames[hovered] || hovered}
        </div>
      )}

      <div className="muscle-map-stage muscle-map-stage--illustration">
        <MuscleIllustration
          selectedMuscles={selectedIds}
          onToggleMuscle={handleSelect}
          hoveredMuscle={hovered}
          onHoverMuscle={setHovered}
        />
      </div>

      <div className="muscle-map-legend">
        {muscles.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`legend-item${hovered === m.id ? ' is-hovered' : ''}${
              selectedIds.includes(m.id) ? ' is-selected' : ''
            }`}
            onClick={() => handleSelect(m.id)}
            onMouseEnter={() => setHovered(m.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="legend-dot" data-region={m.region} />
            {m.name}
          </button>
        ))}
      </div>
    </div>
  )
}
