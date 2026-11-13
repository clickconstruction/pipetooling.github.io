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
 * - /settings#settings-card-and-footer  (Your card and footer, punch list #313; Settings search lands on it)
 * - /settings?tab=settings-people#settings-card-looks (Card and footer looks, the owner's and a dev's card)
 *
 * `?tab=` values are settings tab/group ids (e.g. `settings-data`). Hashes are
 * either a section anchor inside a tab (mapped below) or a tab id themselves.
 * The caller validates the resolved tab id against the role-filtered jump
 * groups before applying it.
 */

import { JOBS_BILLING_CHILD_ANCHORS, JOBS_BILLING_TAB, jobsBillingAnchorToTab } from './settings/jobsBillingGroups'
import { movedSettingsCardAnchorNow, movedSettingsCardAnchorToTab } from './settings/settingsFoldCards'
import { OUR_NAMES_CARD, OUR_NAMES_TAB } from './research/ourNames'

/** Section anchor id → the settings tab/group that renders it. */
export const SETTINGS_HASH_ANCHOR_TO_TAB: Readonly<Record<string, string>> = {
  'settings-time-off': 'settings-account',
  'settings-salary-workday': 'settings-account',
  'settings-dev-mcp-keys': 'settings-account',
  'settings-lien-sign-code': 'settings-account',
  // My email in Messages (punch list #230 PR 3): the My email tab's off line opens the switch here.
  'settings-my-mail': 'settings-account',
  // Cards and footers (punch list #313): a person's own card on Your account, and the owner's looks and sizes on People & teams.
  'settings-card-and-footer': 'settings-account',
  'settings-card-looks': 'settings-people',
  'settings-recently-deleted': 'settings-data',
  'settings-page-pins': 'settings-dashboard',
  'settings-claim-code': 'settings-advanced-tools',
  // Jobs, bills and liens (punch list #261): every card and heading, from the kernel; the Legal desk's firm window has opened `settings-legal-firm` since v2.4711.
  ...jobsBillingAnchorToTab(),
  // The three cards that left Jobs, bills and liens (punch list #261 PR 2): each on its new tab, by its new anchor and its old one.
  ...movedSettingsCardAnchorToTab(),
  // Our names on plumbing permits (punch list #307): the bid guide and the search land on the card.
  [OUR_NAMES_CARD.anchor]: OUR_NAMES_TAB,
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

/** An anchor a card had before it moved tabs → the anchor it carries now, so the page looks for an element that exists. */
const ANCHOR_NOW: Readonly<Record<string, string>> = movedSettingsCardAnchorNow()

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
  const hashId = (hash.startsWith('#') ? hash.slice(1) : hash).trim()
  const rawHash = ANCHOR_NOW[hashId] ?? hashId

  // A link to a card that moved tabs names the card, so the card's tab wins over the `?tab=` the link carried from before the move.
  let tabId: string | null = ANCHOR_NOW[hashId] ? (SETTINGS_HASH_ANCHOR_TO_TAB[rawHash] ?? null) : tabParam.startsWith('settings-') ? tabParam : null
  let anchorId: string | null = null

  if (rawHash && JOBS_BILLING_CHILD_ANCHORS[rawHash]) {
    // An anchor inside a Jobs, bills and liens card (`#who-counts-as-what`): the card opens for it and the page lands on it.
    anchorId = rawHash
    if (!tabId) tabId = JOBS_BILLING_TAB
  } else if (rawHash.startsWith('settings-')) {
    const owningTab = SETTINGS_HASH_ANCHOR_TO_TAB[rawHash] ?? (CONTRACT_CARD_ANCHOR.test(rawHash) ? CONTRACTS_TAB : CLAUSE_PAPER_ANCHOR.test(rawHash) ? CLAUSES_TAB : undefined)
    if (owningTab) {
      anchorId = rawHash
      if (!tabId) tabId = owningTab
    } else if (!tabId) {
      // A hash that names a tab directly (e.g. #settings-data) acts like ?tab=.
      tabId = rawHash
    } else if (rawHash === tabId) {
      // `?tab=X#X`: the hash repeats the tab, so the link means the card that carries the tab's own id. On Activity
      // logs that is Most recent notifications, which sits under an owner's sent emails: land on it (v2.7132).
      anchorId = rawHash
    }
  }

  return { tabId, anchorId }
}
