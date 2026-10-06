/**
 * Deep-link resolution for the Settings page.
 *
 * Inbound links that must keep working (see docs/SETTINGS_TABS_ARCHITECTURE.md):
 * - /settings?tab=settings-data        (DashboardBulkDeleteAlertBanner)
 * - /settings?tab=settings-people      (DashboardClaimDevAttemptsBanner)
 * - /settings#settings-time-off        (legacy bookmarks only — the section moved to the
 *                                       Dashboard My Time "Personal Time Off…" modal in
 *                                       v2.1544; the mapping stays so old links still land
 *                                       on the account tab)
 * - /settings#settings-salary-workday  (Calendar ×3)
 * - /settings?tab=settings-dashboard#settings-page-pins        (Settings search "Page pins" — Tier-2 #17)
 * - /settings?tab=settings-advanced-tools#settings-claim-code  (Needs You "Someone tried to become a dev" — the
 *                                       code form is on Advanced, not People; Tier-2 #17)
 * - /settings#settings-contract-<id>   (one card on Contracts & terms; What customers see links here)
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
  'settings-dev-mcp-keys': 'settings-account',
  'settings-recently-deleted': 'settings-data',
  'settings-page-pins': 'settings-dashboard',
  'settings-claim-code': 'settings-advanced-tools',
  // The Legal desk's firm window opens the firm's block here (v2.4711).
  'settings-legal-firm': 'settings-jobs',
  // The editors Settings → Contracts & terms opens.
  'settings-estimate-public-terms': 'settings-catalogs',
  'settings-estimate-cx-defaults': 'settings-catalogs',
  'settings-bid-cover-letter-defaults': 'settings-catalogs',
}

/** `#settings-contract-<entry id>`: one card on Contracts & terms (the prefix the catalog's anchors carry). */
const CONTRACT_CARD_ANCHOR = /^settings-contract-[a-z][a-z0-9-]*$/
const CONTRACTS_TAB = 'settings-contracts'

/** `?focus=<key>` (v2.3697): a field to land on and ring once its tab shows — `issuer.companyName`, `issuer.addressText`. */
export function settingsFocusParam(search: string): string | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const f = (params.get('focus') ?? '').trim()
  return /^[a-zA-Z][\w.]{0,60}$/.test(f) ? f : null
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
    const owningTab = SETTINGS_HASH_ANCHOR_TO_TAB[rawHash] ?? (CONTRACT_CARD_ANCHOR.test(rawHash) ? CONTRACTS_TAB : undefined)
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
