import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import bodyTypes from '../data/bodyTypes.json'
import BodyTypePicker from '../components/BodyTypePicker'
import { getProfile, saveProfile } from '../utils/storage'

/** 成员 A：身材建档 */
export default function ProfileSetup() {
  const existing = getProfile()
  const currentTypes = useMemo(
    () => bodyTypes.filter((t) => t.kind === 'current'),
    [],
  )

  const [form, setForm] = useState({
    gender: existing.gender || '',
    height: existing.height ?? '',
    weight: existing.weight ?? '',
    chest: existing.chest ?? '',
    waist: existing.waist ?? '',
    hip: existing.hip ?? '',
    bodyFat: existing.bodyFat ?? '',
    currentBodyTypeId: existing.currentBodyTypeId || '',
  })

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSave() {
    saveProfile({
      gender: form.gender,
      height: form.height === '' ? null : Number(form.height),
      weight: form.weight === '' ? null : Number(form.weight),
      chest: form.chest === '' ? null : Number(form.chest),
      waist: form.waist === '' ? null : Number(form.waist),
      hip: form.hip === '' ? null : Number(form.hip),
      bodyFat: form.bodyFat === '' ? null : Number(form.bodyFat),
      currentBodyTypeId: form.currentBodyTypeId,
    })
  }

  const nextPath = existing.path === 'advanced' ? '/anatomy' : '/beginner'

  return (
    <section className="page">
      <h1>完善基础信息</h1>
      <p className="lede">必填性别、身高、体重与当前身材；三围与体脂可选。</p>

      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault()
          handleSave()
        }}
      >
        <label>
          性别
          <select
            value={form.gender}
            onChange={(e) => update('gender', e.target.value)}
            required
          >
            <option value="">请选择</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="other">其他</option>
          </select>
        </label>
        <label>
          身高 (cm)
          <input
            type="number"
            min="100"
            max="250"
            value={form.height}
            onChange={(e) => update('height', e.target.value)}
            required
          />
        </label>
        <label>
          体重 (kg)
          <input
            type="number"
            min="30"
            max="300"
            value={form.weight}
            onChange={(e) => update('weight', e.target.value)}
            required
          />
        </label>
        <label>
          胸围 (cm，可选)
          <input
            type="number"
            value={form.chest}
            onChange={(e) => update('chest', e.target.value)}
          />
        </label>
        <label>
          腰围 (cm，可选)
          <input
            type="number"
            value={form.waist}
            onChange={(e) => update('waist', e.target.value)}
          />
        </label>
        <label>
          臀围 (cm，可选)
          <input
            type="number"
            value={form.hip}
            onChange={(e) => update('hip', e.target.value)}
          />
        </label>
        <label>
          体脂 %（可选）
          <input
            type="number"
            step="0.1"
            value={form.bodyFat}
            onChange={(e) => update('bodyFat', e.target.value)}
          />
        </label>
      </form>

      <h2>当前身材例图</h2>
      <BodyTypePicker
        types={currentTypes}
        value={form.currentBodyTypeId}
        onChange={(id) => update('currentBodyTypeId', id)}
      />

      <div className="cta-row">
        <button type="button" className="btn btn-primary" onClick={handleSave}>
          保存档案
        </button>
        <Link className="btn btn-secondary" to={nextPath} onClick={handleSave}>
          下一步
        </Link>
      </div>

      <p className="owner-note">负责人：成员 A</p>
    </section>
  )
}
