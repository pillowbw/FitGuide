import { useEffect, useRef } from 'react'
import './ExerciseCompletionModal.css'

export default function ExerciseCompletionModal({
  open,
  exerciseName,
  message,
  onClose,
}) {
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose?.()
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="exercise-completion-backdrop"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className="exercise-completion-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-completion-title"
        aria-describedby="exercise-completion-message"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="exercise-completion-icon" aria-hidden="true">
          🎉
        </div>

        <h2 id="exercise-completion-title">完成训练！</h2>
        {exerciseName ? (
          <p className="exercise-completion-subtitle">{exerciseName} 已打卡</p>
        ) : null}

        <div className="exercise-completion-message-panel">
          <p id="exercise-completion-message" className="exercise-completion-message">
            {message}
          </p>
        </div>

        <div className="exercise-completion-actions">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            继续训练
          </button>
        </div>
      </div>
    </div>
  )
}
