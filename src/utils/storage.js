const PROFILE_KEY = 'fitguide_profile'
const PLAN_KEY = 'fitguide_plan'

/**
 * @typedef {Object} UserProfile
 * @property {'male'|'female'|'other'|''} gender
 * @property {number|null} height
 * @property {number|null} weight
 * @property {number|null} [chest]
 * @property {number|null} [waist]
 * @property {number|null} [hip]
 * @property {number|null} [bodyFat]
 * @property {string} currentBodyTypeId
 * @property {'beginner'|'advanced'|''} path
 * @property {'upper'|'core'|'lower'|'full'|''} goalRegion
 * @property {string} targetBodyTypeId
 * @property {string[]} selectedMuscleIds
 */

/** @returns {UserProfile} */
export function createEmptyProfile() {
  return {
    gender: '',
    height: null,
    weight: null,
    chest: null,
    waist: null,
    hip: null,
    bodyFat: null,
    currentBodyTypeId: '',
    path: '',
    goalRegion: '',
    targetBodyTypeId: '',
    selectedMuscleIds: [],
  }
}

/** @returns {UserProfile} */
export function getProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY)
    if (!raw) return createEmptyProfile()
    return { ...createEmptyProfile(), ...JSON.parse(raw) }
  } catch {
    return createEmptyProfile()
  }
}

/** @param {Partial<UserProfile>} patch */
export function saveProfile(patch) {
  const next = { ...getProfile(), ...patch }
  localStorage.setItem(PROFILE_KEY, JSON.stringify(next))
  return next
}

export function clearProfile() {
  localStorage.removeItem(PROFILE_KEY)
}

export function getPlan() {
  try {
    const raw = localStorage.getItem(PLAN_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function savePlan(plan) {
  localStorage.setItem(PLAN_KEY, JSON.stringify(plan))
  return plan
}

export function clearPlan() {
  localStorage.removeItem(PLAN_KEY)
}

/** 建档基础字段是否齐全 */
export function hasBasicProfile(profile = getProfile()) {
  return Boolean(profile.gender && profile.height && profile.weight)
}

/** 是否已有可用于排课的目标肌肉 / 部位 */
export function hasPlanSource(profile = getProfile()) {
  return Boolean(
    profile.selectedMuscleIds?.length ||
      profile.goalRegion ||
      profile.targetBodyTypeId,
  )
}
