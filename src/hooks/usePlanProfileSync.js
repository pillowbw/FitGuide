import { useEffect } from 'react'
import { syncPlanWithProfile } from '../utils/planGenerator'
import {
  PLAN_SYNCED_EVENT,
  PROFILE_CHANGED_EVENT,
  ensureCurrentWeekLog,
} from '../utils/storage'

/**
 * 全局：档案一保存就按新身体数据重算已有训练计划。
 */
export function usePlanProfileSync() {
  useEffect(() => {
    function onProfileChanged(event) {
      const profile = event.detail
      const nextPlan = syncPlanWithProfile(profile)
      if (!nextPlan) return

      ensureCurrentWeekLog(nextPlan)

      window.dispatchEvent(
        new CustomEvent(PLAN_SYNCED_EVENT, {
          detail: { plan: nextPlan, profile },
        }),
      )
    }

    window.addEventListener(PROFILE_CHANGED_EVENT, onProfileChanged)
    return () => {
      window.removeEventListener(PROFILE_CHANGED_EVENT, onProfileChanged)
    }
  }, [])
}
