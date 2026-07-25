/**
 * 成员 B：动作教学视频列表
 * props:
 * - exercises: exercises.json 过滤后的数组
 */
export default function VideoList({ exercises = [] }) {
  if (!exercises.length) {
    return <p className="muted">暂无相关动作，请先补充 exercises.json。</p>
  }

  return (
    <ul className="video-list">
      {exercises.map((ex) => (
        <li key={ex.id}>
          <div>
            <strong>{ex.name}</strong>
            <p>{ex.advice}</p>
            <span className="tag">{ex.level}</span>
          </div>
          <a href={ex.videoUrl} target="_blank" rel="noreferrer">
            观看教学（{ex.videoSource}）
          </a>
        </li>
      ))}
    </ul>
  )
}
