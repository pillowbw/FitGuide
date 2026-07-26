import { useRef } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Prism from './Prism'
import './Layout.css'

gsap.registerPlugin(useGSAP)

const NAV_ITEMS = [
  { to: '/profile', label: '身体档案' },
  { to: '/beginner', label: '新手推荐' },
  { to: '/anatomy', label: '自选肌肉' },
  { to: '/plan', label: '训练计划' },
]

export default function Layout() {
  const shellRef = useRef(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.from('.app-header', {
          y: -16,
          opacity: 0,
          duration: 0.5,
          ease: 'power2.out',
        })
        gsap.from('.nav-link', {
          opacity: 0,
          y: -8,
          duration: 0.4,
          stagger: 0.05,
          delay: 0.15,
          ease: 'power2.out',
        })
      })
    },
    { scope: shellRef },
  )

  return (
    <div className="app-shell" ref={shellRef}>
      <div className="app-prism-bg" aria-hidden="true">
        <Prism
          animationType="rotate"
          timeScale={0.3}
          height={4}
          baseWidth={6}
          scale={4}
          hueShift={0}
          colorFrequency={2}
          noise={0}
          glow={0.5}
        />
      </div>

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