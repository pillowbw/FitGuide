import { useEffect, useId, useRef } from 'react'
import './PlanDetailModal.css'

/**
 * @param {{
 *   open: boolean,
 *   title?: string,
 *   onClose: () => void,
 *   children: import('react').ReactNode,
 * }} props
 */
export default function PlanDetailModal({
  open,
  title = '详情',
  onClose,
  children,
}) {
  const titleId = useId()
  const closeRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()

    function onKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="plan-detail-modal-root" role="presentation">
      <button
        type="button"
        className="plan-detail-modal-backdrop"
        aria-label="关闭详情"
        onClick={onClose}
      />
      <div
        className="plan-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="plan-detail-modal-header">
          <h3 id={titleId}>{title}</h3>
          <button
            ref={closeRef}
            type="button"
            className="plan-detail-modal-close"
            onClick={onClose}
          >
            关闭
          </button>
        </header>
        <div className="plan-detail-modal-body">{children}</div>
      </div>
    </div>
  )
}
