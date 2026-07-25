import { Link, Outlet } from 'react-router-dom'
import './Layout.css'

export default function Layout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <Link to="/" className="brand">
          FitGuide
        </Link>
        <nav className="app-nav">
          <Link to="/profile">建档</Link>
          <Link to="/beginner">业余路径</Link>
          <Link to="/anatomy">解剖图</Link>
          <Link to="/plan">训练计划</Link>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  )
}
