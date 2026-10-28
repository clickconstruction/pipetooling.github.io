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
 * - /settings?tab=settings-phone-texts#settings-phone-texts-hours (the Office hours card, punch list #140 PR 1;
 *                                       PR 2's switch card on Messages lands on it)
 * - /settings?tab=settings-phone-texts#settings-phone-texts-missed-calls (the Missed calls card, punch list #195 PR 2)
 * - /settings?tab=settings-phone-texts#settings-phone-texts-reminders (the Reminders the app offers card, v2.5720;
 *                                       the switch card's Reminders door lands on it)
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
  'settings-lien-sign-code': 'settings-account',
  'settings-recently-deleted': 'settings-data',
  'settings-page-pins': 'settings-dashboard',
  'settings-claim-code': 'settings-advanced-tools',
  // The Legal desk's firm window opens the firm's block here (v2.4711).
  'settings-legal-firm': 'settings-jobs',
  // The editors Settings → Contracts & terms opens.
  'settings-estimate-public-terms': 'settings-catalogs',
  'settings-estimate-cx-defaults': 'settings-catalogs',
  'settings-bid-cover-letter-defaults': 'settings-catalogs',
  // Phone and texts' cards (punch list #140 PR 2): the switch card on Messages opens each by its anchor.
  'settings-phone-texts-send-texts': 'settings-phone-texts',
  'settings-phone-texts-read-bids': 'settings-phone-texts',
  'settings-phone-texts-who-gets-it': 'settings-phone-texts',
  'settings-phone-texts-boxes': 'settings-phone-texts',
  'settings-phone-texts-reply-push': 'settings-phone-texts',
  'settings-phone-texts-quo-seats': 'settings-phone-texts',
  'settings-phone-texts-quo': 'settings-phone-texts',
  'settings-phone-texts-model-keys': 'settings-phone-texts',
  'settings-phone-texts-hours': 'settings-phone-texts',
  'settings-phone-texts-missed-calls': 'settings-phone-texts',
  'settings-phone-texts-reminders': 'settings-phone-texts',
}

/** `#settings-contract-<entry id>`: one card on Contracts & terms (the prefix the catalog's anchors carry). */
const CONTRACT_CARD_ANCHOR = /^settings-contract-[a-z][a-z0-9-]*$/
const CONTRACTS_TAB = 'settings-contracts'
/** `#settings-clause-paper-<document id>`: one paper's card on Contracts and clauses, which the approvers' Needs you opens. */
const CLAUSE_PAPER_ANCHOR = /^settings-clause-paper-[0-9a-f-]{36}$/
const CLAUSES_TAB = 'settings-clauses'

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
    const owningTab = SETTINGS_HASH_ANCHOR_TO_TAB[rawHash] ?? (CONTRACT_CARD_ANCHOR.test(rawHash) ? CONTRACTS_TAB : CLAUSE_PAPER_ANCHOR.test(rawHash) ? CLAUSES_TAB : undefined)
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
