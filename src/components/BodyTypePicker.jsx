/**
 * 成员 A：身材例图选择器
 * props:
 * - types: bodyTypes 数组（可先按 kind 过滤）
 * - value: 当前选中 id
 * - onChange: (id) => void
 */
export default function BodyTypePicker({ types = [], value, onChange }) {
  return (
    <div className="body-type-picker">
      {types.map((type) => {
        const selected = type.id === value
        return (
          <button
            key={type.id}
            type="button"
            className={`body-type-card${selected ? ' is-selected' : ''}`}
            onClick={() => onChange?.(type.id)}
          >
            <img src={type.image} alt={type.label} width={120} height={160} />
            <strong>{type.label}</strong>
            <span>{type.description}</span>
          </button>
        )
      })}
    </div>
  )
}
