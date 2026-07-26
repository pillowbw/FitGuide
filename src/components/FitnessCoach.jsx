import { useEffect, useRef, useState } from 'react'
import { getProfile } from '../utils/storage'
import {
  MAX_MESSAGE_LENGTH,
  pickHistoryForCoach,
  pickPlanForCoach,
  pickProfileForCoach,
  sendFitnessCoachMessage,
} from '../utils/fitnessAgent'
import {
  applyScheduleAdjustment,
  describeScheduleAdjustment,
  detectScheduleAdjustIntent,
} from '../utils/planAssistant'
import './FitnessCoach.css'

const QUICK_QUESTIONS = [
  '周一我有事练不了，帮我改计划',
  '我练了俯卧撑腰很酸是为什么？',
  '平时控制饮食的话是不是减脂效果更明显',
  '锻炼一周好累，不想坚持了，感觉没效果',
]

const WELCOME_MESSAGE =
  '你好，我是 FitGuide 网站助手。你可以让我：① 直接改你的训练日（例如「周一练不了」）；② 解释练后酸痛；③ 回答饮食/减脂问题；④ 在你想放弃时给你务实鼓励。'

const DEMO_HINT =
  '当前是「演示模式」：回复来自本地模板，不是大模型。要真实多轮对话，请在 .env.local 配置 OPENAI_API_KEY 后重启 npm run dev。'

function createMessage(role, content, meta = {}) {
  return {
    id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    role,
    content,
    ...meta,
  }
}

function mergeAssistantText(replyText, appliedNote) {
  const text = (replyText || '').trim()
  if (!appliedNote) return text
  if (!text) return appliedNote
  if (text.includes('已避开') || text.includes('已帮你改') || text.includes('已处理')) {
    return text
  }
  return `${appliedNote}\n\n${text}`
}

export default function FitnessCoach() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState(() => [
    createMessage('assistant', WELCOME_MESSAGE),
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [coachMode, setCoachMode] = useState('demo')

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

  function handleNewConversation() {
    abortRef.current?.abort()
    abortRef.current = null
    setLoading(false)
    setError('')
    setInput('')
    setMessages([createMessage('assistant', WELCOME_MESSAGE)])
    setCoachMode('demo')
    textareaRef.current?.focus()
  }

  async function handleSend(rawMessage) {
    const message = (rawMessage ?? input).trim()

    if (!message || loading) return

    if (message.length > MAX_MESSAGE_LENGTH) {
      setError(`问题过长，请控制在 ${MAX_MESSAGE_LENGTH} 字以内。`)
      return
    }

    const history = pickHistoryForCoach(messages, WELCOME_MESSAGE)

    setError('')
    setInput('')
    setMessages((current) => [...current, createMessage('user', message)])
    setLoading(true)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const intent = detectScheduleAdjustIntent(message)
      let appliedNote = ''
      let planApplied = false

      if (intent) {
        const result = applyScheduleAdjustment(intent)
        appliedNote = describeScheduleAdjustment(result, intent)
        planApplied = result.ok
      }

      const result = await sendFitnessCoachMessage({
        message,
        history,
        profile: pickProfileForCoach(getProfile()),
        plan: pickPlanForCoach(),
        signal: controller.signal,
      })

      // API 若带回结构化动作，且本轮尚未应用，再补一次
      if (
        !planApplied &&
        result.action?.action === 'adjust_schedule' &&
        Array.isArray(result.action.blockedWeekdays) &&
        result.action.blockedWeekdays.length > 0
      ) {
        const fallbackIntent = {
          type: 'block',
          weekdays: result.action.blockedWeekdays.filter(
            (day) => typeof day === 'string',
          ),
        }
        if (fallbackIntent.weekdays.length > 0) {
          const applied = applyScheduleAdjustment(fallbackIntent)
          appliedNote = describeScheduleAdjustment(applied, fallbackIntent)
          planApplied = applied.ok
        }
      }

      setMessages((current) => [
        ...current,
        createMessage(
          'assistant',
          mergeAssistantText(result.text, appliedNote),
          { planApplied },
        ),
      ])
      setCoachMode(result.mode)
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
              <strong>AI 网站助手</strong>
              <p>
                改计划 · 答疑 · 饮食 · 陪你坚持
                {coachMode === 'demo' ? (
                  <span className="fitness-coach-mode-badge">模板演示</span>
                ) : (
                  <span className="fitness-coach-mode-badge is-ai">真实 AI</span>
                )}
              </p>
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

          {coachMode === 'demo' && (
            <p className="fitness-coach-demo-hint" role="status">
              {DEMO_HINT}
            </p>
          )}

          <div className="fitness-coach-messages" ref={listRef}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`fitness-coach-message is-${message.role}`}
              >
                <span className="fitness-coach-message-label">
                  {message.role === 'assistant' ? '助手' : '你'}
                </span>
                <p>{message.content}</p>
                {message.planApplied && (
                  <span className="fitness-coach-applied-badge">
                    已更新计划表
                  </span>
                )}
              </div>
            ))}

            {loading && (
              <div
                className="fitness-coach-message is-assistant is-loading"
                aria-live="polite"
              >
                <span className="fitness-coach-message-label">助手</span>
                <p>正在处理…</p>
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
              placeholder="例如：周一练不了 / 饮食减脂 / 腰酸 / 想放弃"
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
            一般健身参考，非医疗诊断。说「周几练不了」会直接改本机计划表。
          </p>
        </section>
      )}

      <button
        type="button"
        className={`fitness-coach-fab${open ? ' is-open' : ''}`}
        aria-label={open ? '关闭 AI 助手' : '打开 AI 助手'}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {open ? '收起' : 'AI 助手'}
      </button>
    </div>
  )
}
