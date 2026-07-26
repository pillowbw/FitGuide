import { NavLink, Outlet } from 'react-router-dom'
import './Layout.css'

const NAV_ITEMS = [
  { to: '/profile', label: '建档' },
  { to: '/beginner', label: '业余路径' },
  { to: '/anatomy', label: '解剖图' },
  { to: '/plan', label: '训练计划' },
]

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="header-inner">
          <NavLink to="/" end className="brand" aria-label="返回FitGuide首页">
            <span className="brand-mark">F</span>
            <span>FitGuide</span>
          </NavLink>

          <nav className="app-nav" aria-label="主要导航">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'nav-link is-active' : 'nav-link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>

      <footer className="app-footer">
        <p>
          FitGuide提供一般性健身参考。训练时请根据个人情况调整强度，并优先保证动作安全。
        </p>
      </footer>
    </div>
  )
}