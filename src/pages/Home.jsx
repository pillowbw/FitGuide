import { useNavigate } from 'react-router-dom'
import heroImage from '../assets/hero.png'
import { saveProfile } from '../utils/storage'

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
          <h2>我是业余者</h2>
          <p>
            我不知道具体肌肉名称，只知道自己想练哪个部位，或者想拥有怎样的身材。
          </p>

          <ul>
            <li>选择上肢、核心、下肢或全身</li>
            <li>通过例图选择目标身材</li>
            <li>获得系统推荐的训练肌肉</li>
          </ul>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => choosePath('beginner')}
          >
            从简单选择开始
          </button>
        </article>

        <article className="path-card">
          <p className="path-kicker">适合有一定基础的用户</p>
          <h2>我有健身基础</h2>
          <p>
            我已经知道自己想训练的肌肉，希望通过人体肌肉图直接进行选择。
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
            使用进阶选择
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