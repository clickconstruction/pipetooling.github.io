/**
 * Deep-link resolution for the Settings page.
 *
 * Inbound links that must keep working (see docs/SETTINGS_TABS_ARCHITECTURE.md):
 * - /settings?tab=settings-data        (DashboardBulkDeleteAlertBanner)
 * - /settings?tab=settings-people      (DashboardClaimDevAttemptsBanner)
 * - /settings#settings-time-off        (Calendar ×3)
 * - /settings#settings-salary-workday  (Calendar ×3)
 *
 * `?tab=` values are settings tab/group ids (e.g. `settings-data`). Hashes are
 * either a section anchor inside a tab (mapped below) or a tab id themselves.
 * The caller validates the resolved tab id against the role-filtered jump
 * groups before applying it.
 */

/** Section anchor id → the settings tab/group that renders it. */
export const SETTINGS_HASH_ANCHOR_TO_TAB: Readonly<Record<string, string>> = {
  'settings-time-off': 'settings-account',
  'settings-salary-workday': 'settings-account',
}

export type SettingsDeepLink = {
  /** Candidate tab/group id to activate, or null when the URL carries none. */
  tabId: string | null
  /** Element id to scroll into view after the tab renders, or null. */
  anchorId: string | null
}

/**
 * Pure resolver: takes `location.search` and `location.hash` (either may be
 * empty, with or without their leading `?`/`#`) and returns the tab to open
 * and the anchor to scroll to. `?tab=` wins over a tab-shaped hash; a section
 * anchor hash contributes its owning tab when `?tab=` is absent.
 */
export function resolveSettingsDeepLink(search: string, hash: string): SettingsDeepLink {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const tabParam = (params.get('tab') ?? '').trim()
  const rawHash = (hash.startsWith('#') ? hash.slice(1) : hash).trim()

  let tabId: string | null = tabParam.startsWith('settings-') ? tabParam : null
  let anchorId: string | null = null

  if (rawHash.startsWith('settings-')) {
    const owningTab = SETTINGS_HASH_ANCHOR_TO_TAB[rawHash]
    if (owningTab) {
      anchorId = rawHash
      if (!tabId) tabId = owningTab
    } else if (!tabId) {
      // A hash that names a tab directly (e.g. #settings-data) acts like ?tab=.
      tabId = rawHash
    }
  }

  return { tabId, anchorId }
}
