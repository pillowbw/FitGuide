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
        <li key={ex.id} className="video-item">
          <div className="video-info">
            <div className="video-header">
              <strong className="video-name">{ex.name}</strong>
              <span className={`tag level-${ex.level}`}>{ex.level === 'beginner' ? '入门' : '进阶'}</span>
            </div>
            <p className="video-advice">{ex.advice}</p>
          </div>
          <a
            href={ex.videoUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-video"
            aria-label={`观看 ${ex.name} 教学视频（${ex.videoSource === 'youtube' ? 'YouTube' : 'bilibili'}）`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            看视频
          </a>
        </li>
      ))}
    </ul>
  )
}
