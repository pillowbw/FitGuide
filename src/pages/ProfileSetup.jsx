import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import bodyTypes from '../data/bodyTypes.json'
import BodyTypePicker from '../components/BodyTypePicker'
import { usePageReveal } from '../hooks/usePageReveal'
import { getPlan, getProfile, saveProfile } from '../utils/storage'

/** 成员 A：用户身材建档 */
export default function ProfileSetup() {
  const navigate = useNavigate()
  const pageRef = usePageReveal()
  const [existing] = useState(getProfile)

  const currentTypes = useMemo(
    () => bodyTypes.filter((type) => type.kind === 'current'),
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

  const [errors, setErrors] = useState({})
  const [status, setStatus] = useState('')

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))

    setErrors((previous) => ({
      ...previous,
      [field]: '',
    }))

    setStatus('')
  }

  function numberOrNull(value) {
    if (value === '') return null
    return Number(value)
  }

  function validateForm() {
    const nextErrors = {}

    const height = numberOrNull(form.height)
    const weight = numberOrNull(form.weight)
    const chest = numberOrNull(form.chest)
    const waist = numberOrNull(form.waist)
    const hip = numberOrNull(form.hip)
    const bodyFat = numberOrNull(form.bodyFat)

    if (!form.gender) {
      nextErrors.gender = '请选择性别。'
    }

    if (height === null) {
      nextErrors.height = '请输入身高。'
    } else if (!Number.isFinite(height) || height < 100 || height > 250) {
      nextErrors.height = '请输入100～250 cm之间的身高。'
    }

    if (weight === null) {
      nextErrors.weight = '请输入体重。'
    } else if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
      nextErrors.weight = '请输入30～300 kg之间的体重。'
    }

    if (chest !== null && (!Number.isFinite(chest) || chest < 40 || chest > 200)) {
      nextErrors.chest = '胸围应在40～200 cm之间。'
    }

    if (waist !== null && (!Number.isFinite(waist) || waist < 40 || waist > 200)) {
      nextErrors.waist = '腰围应在40～200 cm之间。'
    }

    if (hip !== null && (!Number.isFinite(hip) || hip < 40 || hip > 200)) {
      nextErrors.hip = '臀围应在40～200 cm之间。'
    }

    if (
      bodyFat !== null &&
      (!Number.isFinite(bodyFat) || bodyFat < 1 || bodyFat > 70)
    ) {
      nextErrors.bodyFat = '体脂率应在1%～70%之间。'
    }

    if (!form.currentBodyTypeId) {
      nextErrors.currentBodyTypeId = '请选择最接近你当前情况的身材。'
    }

    setErrors(nextErrors)

    return Object.keys(nextErrors).length === 0
  }

  function saveForm(shouldContinue) {
    if (!validateForm()) {
      setStatus('请检查页面中标出的必填项或错误信息。')
      return
    }

    const path = existing.path === 'advanced' ? 'advanced' : 'beginner'

    saveProfile({
      gender: form.gender,
      height: numberOrNull(form.height),
      weight: numberOrNull(form.weight),
      chest: numberOrNull(form.chest),
      waist: numberOrNull(form.waist),
      hip: numberOrNull(form.hip),
      bodyFat: numberOrNull(form.bodyFat),
      currentBodyTypeId: form.currentBodyTypeId,
      path,
    })

    const planSynced = Boolean(getPlan())

    if (shouldContinue) {
      navigate(path === 'advanced' ? '/anatomy' : '/beginner')
      return
    }

    setStatus(
      planSynced
        ? '档案已保存，训练计划已按新的身体数据自动更新。'
        : '档案已成功保存。',
    )
  }

  function handleSubmit(event) {
    event.preventDefault()
    saveForm(true)
  }

  return (
    <section className="page profile-page" ref={pageRef}>
      <div>
        <p className="eyebrow">第 1 步 · 建立个人档案</p>
        <h1>完善基础信息</h1>
        <p className="lede">
          性别、身高、体重和当前身材为必填项；三围和体脂率可以稍后补充。
        </p>
      </div>

      <form className="profile-form" onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <label>
            <span className="field-label">
              性别 <strong>*</strong>
            </span>
            <select
              value={form.gender}
              className={errors.gender ? 'input-error' : ''}
              aria-invalid={Boolean(errors.gender)}
              onChange={(event) => update('gender', event.target.value)}
            >
              <option value="">请选择</option>
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
            {errors.gender && (
              <span className="field-error">{errors.gender}</span>
            )}
          </label>

          <label>
            <span className="field-label">
              身高（cm）<strong>*</strong>
            </span>
            <input
              type="number"
              min="100"
              max="250"
              step="0.1"
              inputMode="decimal"
              placeholder="例如：175"
              value={form.height}
              className={errors.height ? 'input-error' : ''}
              aria-invalid={Boolean(errors.height)}
              onChange={(event) => update('height', event.target.value)}
            />
            {errors.height && (
              <span className="field-error">{errors.height}</span>
            )}
          </label>

          <label>
            <span className="field-label">
              体重（kg）<strong>*</strong>
            </span>
            <input
              type="number"
              min="30"
              max="300"
              step="0.1"
              inputMode="decimal"
              placeholder="例如：65"
              value={form.weight}
              className={errors.weight ? 'input-error' : ''}
              aria-invalid={Boolean(errors.weight)}
              onChange={(event) => update('weight', event.target.value)}
            />
            {errors.weight && (
              <span className="field-error">{errors.weight}</span>
            )}
          </label>

          <label>
            <span className="field-label">胸围（cm，可选）</span>
            <input
              type="number"
              min="40"
              max="200"
              step="0.1"
              inputMode="decimal"
              placeholder="例如：90"
              value={form.chest}
              className={errors.chest ? 'input-error' : ''}
              aria-invalid={Boolean(errors.chest)}
              onChange={(event) => update('chest', event.target.value)}
            />
            {errors.chest && (
              <span className="field-error">{errors.chest}</span>
            )}
          </label>

          <label>
            <span className="field-label">腰围（cm，可选）</span>
            <input
              type="number"
              min="40"
              max="200"
              step="0.1"
              inputMode="decimal"
              placeholder="例如：75"
              value={form.waist}
              className={errors.waist ? 'input-error' : ''}
              aria-invalid={Boolean(errors.waist)}
              onChange={(event) => update('waist', event.target.value)}
            />
            {errors.waist && (
              <span className="field-error">{errors.waist}</span>
            )}
          </label>

          <label>
            <span className="field-label">臀围（cm，可选）</span>
            <input
              type="number"
              min="40"
              max="200"
              step="0.1"
              inputMode="decimal"
              placeholder="例如：95"
              value={form.hip}
              className={errors.hip ? 'input-error' : ''}
              aria-invalid={Boolean(errors.hip)}
              onChange={(event) => update('hip', event.target.value)}
            />
            {errors.hip && (
              <span className="field-error">{errors.hip}</span>
            )}
          </label>

          <label>
            <span className="field-label">体脂率（%，可选）</span>
            <input
              type="number"
              min="1"
              max="70"
              step="0.1"
              inputMode="decimal"
              placeholder="例如：18"
              value={form.bodyFat}
              className={errors.bodyFat ? 'input-error' : ''}
              aria-invalid={Boolean(errors.bodyFat)}
              onChange={(event) => update('bodyFat', event.target.value)}
            />
            {errors.bodyFat && (
              <span className="field-error">{errors.bodyFat}</span>
            )}
          </label>
        </div>

        <div className="profile-body-section">
          <div>
            <h2>选择当前身材</h2>
            <p className="muted">选择与你目前情况最接近的例图即可。</p>
          </div>

          <BodyTypePicker
            types={currentTypes}
            value={form.currentBodyTypeId}
            onChange={(id) => update('currentBodyTypeId', id)}
          />

          {errors.currentBodyTypeId && (
            <p className="field-error">{errors.currentBodyTypeId}</p>
          )}
        </div>

        {status && (
          <p
            className={
              Object.values(errors).some(Boolean)
                ? 'form-status form-status-error'
                : 'form-status form-status-success'
            }
            role="status"
          >
            {status}
          </p>
        )}

        <div className="cta-row profile-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => saveForm(false)}
          >
            仅保存档案
          </button>

          <button type="submit" className="btn btn-primary">
            保存并进入下一步
          </button>
        </div>
      </form>
    </section>
  )
}