import { buildWeeklyOverviewRows, getDayAnchorId } from '../utils/planOverview'
import './WeeklyPlanOverview.css'

function scrollToAnchor(anchorId) {
  const target = document.getElementById(anchorId)
  if (!target) return
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  target.classList.add('plan-overview-flash')
  window.setTimeout(() => {
    target.classList.remove('plan-overview-flash')
  }, 1200)
}

/**
 * @param {{ plan: object|null }} props
 */
export default function WeeklyPlanOverview({ plan }) {
  const rows = buildWeeklyOverviewRows(plan)

  if (rows.length === 0) return null

  return (
    <section className="weekly-plan-overview" aria-label="本周训练计划总览">
      <header className="weekly-plan-overview-header">
        <h2>本周训练计划总览</h2>
        <p className="muted">点击动作名称可跳转到下方对应视频</p>
      </header>

      <div className="weekly-plan-overview-scroll">
        <table className="weekly-plan-overview-table">
          <thead>
            <tr>
              <th scope="col">星期</th>
              <th scope="col">今日训练目标</th>
              <th scope="col">动作列表</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.weekday}
                className={[
                  row.isToday ? 'is-today' : '',
                  row.isRest ? 'is-rest' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <th scope="row">
                  <span className="weekly-plan-weekday">{row.weekday}</span>
                  {row.isToday && (
                    <span className="weekly-plan-today-badge">今天</span>
                  )}
                </th>
                <td>
                  {row.isRest ? (
                    <span className="weekly-plan-rest-label">{row.goal}</span>
                  ) : (
                    <button
                      type="button"
                      className="weekly-plan-goal-link"
                      onClick={() =>
                        row.dayIndex != null &&
                        scrollToAnchor(getDayAnchorId(row.dayIndex))
                      }
                    >
                      {row.goal}
                    </button>
                  )}
                </td>
                <td>
                  {row.isRest ? (
                    <span className="weekly-plan-rest-hint">{row.restHint}</span>
                  ) : (
                    <ul className="weekly-plan-exercise-list">
                      {row.exercises.map((exercise) => (
                        <li key={exercise.id}>
                          <button
                            type="button"
                            className="weekly-plan-exercise-link"
                            onClick={() => scrollToAnchor(exercise.anchorId)}
                          >
                            {exercise.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
