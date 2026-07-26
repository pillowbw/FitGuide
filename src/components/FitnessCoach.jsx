import { useEffect, useRef, useState } from 'react'
import { getProfile } from '../utils/storage'
import {
  MAX_MESSAGE_LENGTH,
  pickProfileForCoach,
  sendFitnessCoachMessage,
} from '../utils/fitnessAgent'
import './FitnessCoach.css'

const RESPONSE_ID_KEY = 'fitguide_coach_response_id'

const QUICK_QUESTIONS = [
  '我每周只能练3天，怎么安排？',
  '练完不酸是不是没效果？',
  '减脂期间还需要力量训练吗？',
  '如何判断动作重量是否合适？',
]

const WELCOME_MESSAGE =
  '你好，我是 FitGuide AI 教练。训练、动作、恢复或基础营养问题都可以问我；我会结合你的档案尽量给出能马上执行的建议。'

function createMessage(role, content) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
  }
}

export default function FitnessCoach() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => [createMessage('assistant', WELCOME_MESSAGE)])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [previousResponseId, setPreviousResponseId] = useState(() => {
    try {
      return sessionStorage.getItem(RESPONSE_ID_KEY)
    } catch {
      return null
    }
  })

  const listRef = useRef(null)
  const textareaRef = useRef(null)
  const abortRef = useRef(null)

  useEffect(() => {
    if (!open || !listRef.current) return
    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages, open, loading])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function persistResponseId(nextId) {
    setPreviousResponseId(nextId)
    try {
      if (nextId) {
        sessionStorage.setItem(RESPONSE_ID_KEY, nextId)
      } else {
        sessionStorage.removeItem(RESPONSE_ID_KEY)
      }
    } catch {
      // ignore storage failures
    }
  }

  function handleNewConversation() {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setError('')
    setInput('')
    setMessages([createMessage('assistant', WELCOME_MESSAGE)])
    persistResponseId(null)
    textareaRef.current?.focus()
  }

  async function handleSend(rawMessage) {
    const message = (rawMessage ?? input).trim()

    if (!message || loading) return

    if (message.length > MAX_MESSAGE_LENGTH) {
      setError(`问题过长，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。`)
      return
    }

    setError('')
    setInput('')
    setMessages((current) => [
      ...current,
      createMessage('user', message),
    ])
    setLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const result = await sendFitnessCoachMessage({
        message,
        previousResponseId,
        profile: pickProfileForCoach(getProfile()),
        signal: controller.signal,
      })

      setMessages((current) => [
        ...current,
        createMessage('assistant', result.text),
      ])
      persistResponseId(result.responseId)
    } catch (sendError) {
      if (sendError instanceof Error && sendError.name === 'AbortError') {
        return
      }

      setError(
        sendError instanceof Error
          ? sendError.message
          : '发送失败，请稍后再试。',
      )
    } finally {
      setLoading(false)
      abortRef.current = null
    }
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fitness-coach-root">
      {open && (
        <section
          className="fitness-coach-panel"
          aria-label="FitGuide AI 健身教练对话"
        >
          <header className="fitness-coach-header">
            <div>
              <strong>AI 健身教练</strong>
              <p>训练 · 动作 · 恢复 · 基础营养</p>
            </div>
            <div className="fitness-coach-header-actions">
              <button
                type="button"
                className="fitness-coach-icon-btn"
                onClick={handleNewConversation}
                aria-label="开始新对话"
                title="新对话"
              >
                ↺
              </button>
              <button
                type="button"
                className="fitness-coach-icon-btn"
                onClick={() => setOpen(false)}
                aria-label="关闭 AI 教练"
                title="关闭"
              >
                ✕
              </button>
            </div>
          </header>

          <div className="fitness-coach-messages" ref={listRef}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`fitness-coach-message is-${message.role}`}
              >
                <span className="fitness-coach-message-label">
                  {message.role === 'assistant' ? '教练' : '你'}
                </span>
                <p>{message.content}</p>
              </div>
            ))}

            {loading && (
              <div
                className="fitness-coach-message is-assistant is-loading"
                aria-live="polite"
              >
                <span className="fitness-coach-message-label">教练</span>
                <p>正在思考…</p>
              </div>
            )}
          </div>

          {messages.length === 1 && !loading && (
            <div className="fitness-coach-quick">
              {QUICK_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  className="fitness-coach-quick-btn"
                  onClick={() => handleSend(question)}
                >
                  {question}
                </button>
              ))}
            </div>
          )}

          {error && (
            <p className="fitness-coach-error" role="alert">
              {error}
            </p>
          )}

          <footer className="fitness-coach-composer">
            <textarea
              ref={textareaRef}
              value={input}
              rows={2}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="输入健身问题，Enter 发送，Shift+Enter 换行"
              aria-label="输入健身问题"
              disabled={loading}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              type="button"
              className="btn btn-primary fitness-coach-send"
              disabled={loading || !input.trim()}
              onClick={() => handleSend()}
            >
              发送
            </button>
          </footer>

          <p className="fitness-coach-disclaimer">
            一般健身参考，非医疗诊断。如有持续疼痛或紧急症状，请咨询专业人员。
          </p>
        </section>
      )}

      <button
        type="button"
        className={`fitness-coach-fab${open ? ' is-open' : ''}`}
        aria-label={open ? '关闭 AI 教练' : '打开 AI 教练'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? '收起' : 'AI 教练'}
      </button>
    </div>
  )
}
