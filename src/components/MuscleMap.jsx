import { useState } from 'react'
import { MuscleIllustration } from './body/MuscleIllustration'

/**
 * 正反面一体人体肌肉图（来自 Workout.cool，MIT）
 * props:
 * - muscles: muscles.json 数组
 * - selectedIds: 高亮 / 已选肌肉 id 列表
 * - interactiveIds: 若传入，仅这些肌肉可点击（其余锁定）
 * - onSelect: (muscleId) => void
 */
export default function MuscleMap({
  muscles = [],
  selectedIds = [],
  interactiveIds,
  onSelect,
}) {
  const [hovered, setHovered] = useState(null)
  const isRestricted = Array.isArray(interactiveIds)

  const muscleNames = muscles.reduce((acc, m) => {
    acc[m.id] = m.name
    return acc
  }, {})

  function canInteract(muscleId) {
    return !isRestricted || interactiveIds.includes(muscleId)
  }

  function handleSelect(muscleId) {
    if (!canInteract(muscleId)) return
    onSelect?.(muscleId)
  }

  const legendMuscles = isRestricted
    ? muscles.filter((m) => interactiveIds.includes(m.id))
    : muscles

  return (
    <div
      className={`muscle-map${isRestricted ? ' muscle-map--restricted' : ''}`}
    >
      {hovered && (
        <div className="muscle-map-tooltip">
          {muscleNames[hovered] || hovered}
          {isRestricted && !canInteract(hovered) ? '（非推荐）' : ''}
        </div>
      )}

      <div className="muscle-map-stage muscle-map-stage--illustration">
        <MuscleIllustration
          selectedMuscles={selectedIds}
          interactiveMuscles={interactiveIds}
          onToggleMuscle={handleSelect}
          hoveredMuscle={hovered}
          onHoverMuscle={setHovered}
        />
      </div>

      <div className="muscle-map-legend">
        {isRestricted && (
          <p className="muscle-map-legend-note">高亮为推荐肌肉，可点击查看详情</p>
        )}
        {legendMuscles.map((m) => (
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
