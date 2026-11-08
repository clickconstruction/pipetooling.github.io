import { useEffect, useSyncExternalStore } from 'react'
import { getLineBudgetSettingsSnapshot, loadLineBudgetSettings, subscribeLineBudgetSettings } from '../lib/jobs/lineBudgetSettingsStore'
import type { LineBudgetSettings } from '../lib/jobs/lineBudgets'

/**
 * The company's line budget settings for a component (punch list #234 PR 1b): the shared snapshot,
 * read from `app_settings` on the first mount anywhere and re-read when the owner saves. The
 * constants stand in until the read lands, so nothing waits on it.
 */
export function useLineBudgetSettings(): { settings: LineBudgetSettings; loaded: boolean; savedAt: string | null } {
  const snap = useSyncExternalStore(subscribeLineBudgetSettings, getLineBudgetSettingsSnapshot, getLineBudgetSettingsSnapshot)
  useEffect(() => {
    void loadLineBudgetSettings()
  }, [])
  return snap
}
