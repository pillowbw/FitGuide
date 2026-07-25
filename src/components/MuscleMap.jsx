/**
 * 成员 B：正反面肌肉热区图
 * props:
 * - side: 'front' | 'back'
 * - muscles: muscles.json 过滤后的数组
 * - onSelect: (muscleId) => void
 *
 * TODO: 替换为真实 SVG path / 图片热区；当前用按钮列表占位。
 */
export default function MuscleMap({ side = 'front', muscles = [], onSelect }) {
  const list = muscles.filter((m) => m.side === side)

  return (
    <div className="muscle-map" data-side={side}>
      <p className="muscle-map-hint">
        {side === 'front' ? '正面' : '背面'}肌肉图（占位：点击下方肌肉）
      </p>
      <div className="muscle-map-grid">
        {list.map((muscle) => (
          <button
            key={muscle.id}
            type="button"
            className="muscle-hotspot"
            onClick={() => onSelect?.(muscle.id)}
          >
            {muscle.name}
          </button>
        ))}
      </div>
    </div>
  )
}
