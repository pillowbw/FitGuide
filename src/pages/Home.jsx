import { Link } from 'react-router-dom'
import { saveProfile } from '../utils/storage'

/** 成员 A：首页 — 选择业余 / 进阶路径 */
export default function Home() {
  return (
    <section className="page">
      <p className="eyebrow">FitGuide</p>
      <h1>知道练哪里，也知道怎么练</h1>
      <p className="lede">
        先完善身材档案，再按你的经验选择路径：业余看目标身材推荐；进阶直接点选肌肉。
      </p>

      <div className="cta-row">
        <Link
          className="btn btn-primary"
          to="/profile"
          onClick={() => saveProfile({ path: 'beginner' })}
        >
          我是业余者
        </Link>
        <Link
          className="btn btn-secondary"
          to="/profile"
          onClick={() => saveProfile({ path: 'advanced' })}
        >
          我有一点基础
        </Link>
      </div>

      <p className="owner-note">负责人：成员 A（Home / Profile / Beginner）</p>
    </section>
  )
}
