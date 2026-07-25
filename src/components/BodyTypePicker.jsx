import { useState } from 'react'

function BodyTypeCard({ type, selected, onChange }) {
  const [imageFailed, setImageFailed] = useState(false)

  return (
    <button
      type="button"
      className={`body-type-card${selected ? ' is-selected' : ''}`}
      aria-pressed={selected}
      aria-label={`选择${type.label}身材`}
      onClick={() => onChange?.(type.id)}
    >
      {selected && (
        <span className="body-type-selected-badge" aria-hidden="true">
          已选择
        </span>
      )}

      <div className="body-type-image-wrap">
        {imageFailed ? (
          <div className="body-type-image-fallback">
            <strong>{type.label}</strong>
            <span>图片暂时无法显示</span>
          </div>
        ) : (
          <img
            src={type.image}
            alt={`${type.label}身材示意图`}
            width="240"
            height="320"
            loading="lazy"
            onError={() => setImageFailed(true)}
          />
        )}
      </div>

      <div className="body-type-content">
        <strong className="body-type-name">{type.label}</strong>
        <span className="body-type-description">{type.description}</span>
      </div>

      <span className="body-type-radio" aria-hidden="true">
        {selected ? '✓' : ''}
      </span>
    </button>
  )
}

/**
 * 成员 A：身材例图选择器
 * types：bodyTypes 数组
 * value：当前选中的身材 ID
 * onChange：选中身材时执行的函数
 */
export default function BodyTypePicker({ types = [], value, onChange }) {
  if (types.length === 0) {
    return <p className="muted">暂无可选择的身材类型。</p>
  }

  return (
    <div className="body-type-picker" role="group" aria-label="身材类型选择">
      {types.map((type) => (
        <BodyTypeCard
          key={type.id}
          type={type}
          selected={type.id === value}
          onChange={onChange}
        />
      ))}
    </div>
  )
}