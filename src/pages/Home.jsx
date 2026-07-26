import { useNavigate } from 'react-router-dom'
import BounceCards from '../components/BounceCards'
import { saveProfile } from '../utils/storage'

const EXERCISE_THUMBS = [
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=400&q=80',
  'https://images.unsplash.com/photo-1598971457999-ca4ef48a9a71?w=400&q=80',
  'https://images.unsplash.com/photo-1566241142559-40e1dab266c6?w=400&q=80',
  'https://images.unsplash.com/photo-1598266663439-2056e6900339?w=400&q=80',
  'https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=400&q=80',
]

const TRANSFORM_STYLES = [
  'rotate(8deg) translate(-180px)',
  'rotate(4deg) translate(-90px)',
  'rotate(-2deg)',
  'rotate(-8deg) translate(90px)',
  'rotate(-4deg) translate(180px)',
]

/** 成员 A：首页路径选择 */
export default function Home() {
  const navigate = useNavigate()

  function choosePath(path) {
    saveProfile({ path })
    navigate('/profile')
  }

  return (
    <section className="page home-page">
      <div className="home-hero">
        <div className="home-visual" aria-hidden="true">
          <BounceCards
            images={EXERCISE_THUMBS}
            containerWidth={500}
            containerHeight={320}
            animationDelay={0.3}
            animationStagger={0.1}
            transformStyles={TRANSFORM_STYLES}
            enableHover
          />
        </div>

        <div className="home-copy">
          <p className="eyebrow">FITGUIDE · 个性化健身指南</p>
          <h1>不需要记住肌肉名称，也能找到适合自己的训练方向</h1>
          <p className="lede">
            先建立个人身体档案，再根据你的健身经验选择使用方式。
            我们会帮助你找到目标肌肉，并生成一份训练计划。
          </p>
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
