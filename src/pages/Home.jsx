import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import heroImage from '../assets/hero.png'
import { saveProfile } from '../utils/storage'

gsap.registerPlugin(useGSAP)

/** 成员 A：首页路径选择 */
export default function Home() {
  const navigate = useNavigate()
  const pageRef = useRef(null)

  useGSAP(
    () => {
      const mm = gsap.matchMedia()

      mm.add('(prefers-reduced-motion: no-preference)', () => {
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

        tl.from('.home-copy > *', {
          opacity: 0,
          y: 28,
          duration: 0.65,
          stagger: 0.1,
        })
          .from(
            '.home-visual',
            {
              opacity: 0,
              scale: 0.92,
              duration: 0.75,
              ease: 'power2.out',
            },
            '-=0.45',
          )
          .from(
            '.path-card',
            {
              opacity: 0,
              y: 36,
              duration: 0.6,
              stagger: 0.12,
            },
            '-=0.35',
          )
          .from(
            '.home-steps span',
            {
              opacity: 0,
              y: 16,
              duration: 0.45,
              stagger: 0.06,
            },
            '-=0.25',
          )
      })
    },
    { scope: pageRef },
  )

  function choosePath(path) {
    saveProfile({ path })
    navigate('/profile')
  }

  return (
    <section className="page home-page" ref={pageRef}>
      <div className="home-hero">
        <div className="home-copy">
          <p className="eyebrow">FITGUIDE · 个性化健身指南</p>
          <h1>不需要记住肌肉名称，也能找到适合自己的训练方向</h1>
          <p className="lede">
            先建立个人身体档案，再根据你的健身经验选择使用方式。
            我们会帮助你找到目标肌肉，并生成一份训练计划。
          </p>
        </div>

        <div className="home-visual" aria-hidden="true">
          <img src={heroImage} alt="" />
        </div>
      </div>

      <div className="home-paths">
        <article className="path-card path-card-primary">
          <p className="path-kicker">适合健身新手</p>
          <h2>新手推荐</h2>
          <p>
            不需要知道肌肉名称。选择想练的部位和目标身材，系统会在解剖图上高亮推荐肌肉。
          </p>

          <ul>
            <li>选择上肢、核心、下肢或全身</li>
            <li>通过例图选择目标身材</li>
            <li>在解剖图上查看推荐肌肉</li>
          </ul>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => choosePath('beginner')}
          >
            开始新手推荐
          </button>
        </article>

        <article className="path-card">
          <p className="path-kicker">适合有一定基础的用户</p>
          <h2>自选肌肉</h2>
          <p>
            已经知道想练哪块肌肉时，可直接在人体解剖图上点选目标肌肉。
          </p>

          <ul>
            <li>查看人体正面和背面肌肉</li>
            <li>直接选择具体目标肌肉</li>
            <li>查看动作介绍和训练计划</li>
          </ul>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => choosePath('advanced')}
          >
            打开自选肌肉
          </button>
        </article>
      </div>

      <div className="home-steps">
        <span>1. 建立档案</span>
        <span>2. 选择目标</span>
        <span>3. 获取推荐</span>
        <span>4. 生成计划</span>
      </div>
    </section>
  )
}
