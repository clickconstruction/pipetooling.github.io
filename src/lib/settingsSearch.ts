/**
 * Settings search (v2.2084): the page has up to twelve role-gated tabs and
 * sections three clicks deep, so the search bar above the tab bar matches a
 * CURATED index of setting names + plain-language keywords ("vacation" finds
 * Personal time off) and jumps to the owning tab (and section anchor when one
 * exists — same ids the deep-link system uses, see settingsDeepLink.ts).
 *
 * The index is deliberately hand-written, not scraped: headings across the
 * tab components use inconsistent markup, and a curated list lets entries
 * carry the words people actually type. When a section moves tabs, update its
 * entry here (the drift cost is one line).
 *
 * Role safety comes free: callers pass the role-filtered jump-group ids and
 * `searchSettings` only returns entries whose tab the viewer can see.
 */

import { HELP_GUIDE_URL_PARAM } from './helpGuideUrlParam'

export type SettingsSearchEntry = {
  /** Display label — the setting/section name as the page shows it. */
  label: string
  /** Extra match words (lowercase): synonyms, old names, what people type. */
  keywords?: string[]
  /** Owning tab/group id from getSettingsJumpGroups. */
  tabId: string
  /** DOM id to scroll to after the tab opens (only ids that really exist). */
  anchorId?: string
  /** Help-guide slug (v2.2902): the pick opens this guide on the Guides tab via the `g` URL param. */
  guideSlug?: string
}

export const SETTINGS_SEARCH_INDEX: readonly SettingsSearchEntry[] = [
  // What customers see (v2.2758)
  { label: 'What customers see', keywords: ['customer view', 'sample customer', 'estimate email preview', 'bid room preview', 'portal preview', 'journeys', 'what the customer sees'], tabId: 'settings-what-customers-see' },
  // What the team sees (v2.4142)
  { label: 'What the team sees', keywords: ['team emails', 'staff emails', 'digest preview', 'crew day preview', 'money waiting preview', 'what does a controller get', 'who gets which email', 'sign-in email preview', 'invitation preview', 'workflow notification preview', 'email subjects'], tabId: 'settings-what-the-team-sees' },
  // What everyone sees (punch list #194)
  { label: 'What everyone sees', keywords: ['every screen', 'every role', 'lens', 'sealed frame', 'invented data', 'test data', 'style review', 'theme review', 'dark mode review', 'empty states', 'loading states', 'error states', 'offline', 'training mode', 'what does an estimator see', 'what does a helper see'], tabId: 'settings-what-everyone-sees' },
  // Contracts & terms
  { label: 'Contracts and clauses', keywords: ['clause', 'clauses', 'exhibit', 'trade exhibit', 'master agreement', 'statement of work', 'approve a clause', 'contract version'], tabId: 'settings-clauses' },
  // Training (punch list #111): the courses the crew must take and how long a pass is good for
  { label: 'Training', keywords: ['training', 'course', 'courses', 'osha', 'osha 30', 'refresher', 'lessons', 'who must take', 'good for', 'lapsed', 'take it again', 'everyone takes it again'], tabId: 'settings-training' },
  // Messages: the steps each kind of person goes through
  { label: 'Flows', keywords: ['flow', 'flows', 'step', 'steps', 'nudge', 'reminder', 'whose move', 'finished when', 'fact', 'fork', 'how it is going', 'funnel', 'add a new paper'], tabId: 'settings-flows' },
  { label: 'Contracts & terms', keywords: ['contract', 'contracts', 'terms and conditions', 'legal wording', 'agreement', 'warranty', 'exclusions', 'what we send', 'side by side', 'compare contracts', 'lien waiver', 'esign', 'electronic signature'], tabId: 'settings-contracts' },
  { label: 'Estimate Terms and Conditions', keywords: ['estimate terms', 'public terms', 'terms page'], tabId: 'settings-contracts', anchorId: 'settings-contract-estimate-terms' },
  { label: 'Bid terms & warranty', keywords: ['bid terms', 'proposal terms', 'bid room terms'], tabId: 'settings-contracts', anchorId: 'settings-contract-bid-terms' },
  { label: 'Job service agreement — standard terms', keywords: ['standard terms', 'service agreement', 'job contract terms'], tabId: 'settings-contracts', anchorId: 'settings-contract-job-standard-terms' },
  // Notifications
  { label: 'Push notifications', keywords: ['alerts', 'phone notifications', 'enable notifications'], tabId: 'settings-recent-push' },
  { label: 'Recent emails sent', keywords: ['email log', 'sent mail'], tabId: 'settings-recent-push', anchorId: 'settings-recent-emails' },
  // Your account
  { label: 'My profile', keywords: ['name', 'password', 'email address', 'account'], tabId: 'settings-account' },
  { label: 'Push me', keywords: ['push hours', 'quiet hours', 'notification hours', 'when you are pushed', 'do not disturb', 'push notifications'], tabId: 'settings-account', anchorId: 'settings-push-hours' },
  { label: 'Salaried workday', keywords: ['salary', 'auto clock', 'work schedule'], tabId: 'settings-account', anchorId: 'settings-salary-workday' },
  { label: 'Personal time off', keywords: ['pto', 'vacation', 'time off', 'holiday'], tabId: 'settings-account', anchorId: 'settings-salary-workday' },
  { label: 'Back up my data', keywords: ['backup', 'export', 'download my data'], tabId: 'settings-account' },
  // Dashboard & alerts
  { label: 'Defaults for everyone', keywords: ['defaults', 'org defaults', 'role defaults', 'mobile cards', 'payroll auto-apply', 'stripe mode', 'new device'], tabId: 'settings-company', anchorId: 'settings-org-defaults' },
  { label: 'Dashboard quick buttons', keywords: ['quick add', 'new job button', 'shortcuts'], tabId: 'settings-dashboard' },
  { label: 'Quick-Add Task icon', keywords: ['add task', 'home screen'], tabId: 'settings-dashboard' },
  { label: 'Daily goals', keywords: ['goals', 'checklist goals'], tabId: 'settings-dashboard' },
  { label: 'Report notifications', keywords: ['field reports', 'report emails'], tabId: 'settings-dashboard' },
  { label: 'My reports', keywords: ['report subscriptions', 'email reports'], tabId: 'settings-dashboard' },
  { label: 'Financial pins', keywords: ['billed pin', 'sub labor due', 'supply houses ap', 'internal team labor', 'money pins'], tabId: 'settings-dashboard', anchorId: 'settings-page-pins' },
  // Page pins live under Dashboard Page Pins on Your dashboard — the entry used to point at Your account (J28-F3).
  { label: 'Page pins', keywords: ['pinned pages', 'pins', 'clear pins'], tabId: 'settings-dashboard', anchorId: 'settings-page-pins' },
  // People & accounts (dev + master)
  { label: 'User management', keywords: ['users', 'accounts', 'roles', 'archive user'], tabId: 'settings-people' },
  { label: 'Invite via email', keywords: ['invite user', 'add user', 'new account'], tabId: 'settings-people' },
  { label: 'Merge users', keywords: ['combine users', 'duplicate accounts'], tabId: 'settings-people' },
  { label: 'Active accounts', keywords: ['who is active', 'logins'], tabId: 'settings-people' },
  { label: 'Report-enabled users', keywords: ['who can report'], tabId: 'settings-people' },
  // Email & notifications (dev)
  { label: 'Email streams', keywords: ['scheduled emails', 'email subscriptions', 'weekly emails'], tabId: 'settings-emails' },
  { label: 'My email schedule', keywords: ['when emails send', 'email times'], tabId: 'settings-emails' },
  { label: 'Workflow stage notifications', keywords: ['stage emails', 'workflow alerts'], tabId: 'settings-emails' },
  // Dev doors (v2.5882): the map of every dev-only and controller-only door
  { label: 'Dev doors', keywords: ['dev only', 'controller only', 'owner or dev', 'doors', 'gates', 'who can open', 'hidden pages', 'dev settings', 'only devs'], tabId: 'settings-dev-doors' },
  // Data & recovery (dev)
  { label: 'Backups & exports', keywords: ['backup', 'export data', 'csv'], tabId: 'settings-data' },
  { label: 'Recently deleted', keywords: ['trash', 'restore', 'undelete', 'deleted records'], tabId: 'settings-data', anchorId: 'settings-recently-deleted' },
  { label: 'Bulk-deletion alert', keywords: ['mass delete', 'deletion warning'], tabId: 'settings-data' },
  { label: 'Link jobs to their bids', keywords: ['backfill', 'bid link', 'matches by value', 'job budget', 'burn'], tabId: 'settings-data', anchorId: 'settings-bid-job-backfill' },
  // Jobs & dispatch (dev)
  { label: 'Trip charge amounts', keywords: ['trip fee', 'travel charge'], tabId: 'settings-jobs' },
  { label: 'Re-assign jobs', keywords: ['transfer jobs', 'move jobs to another user'], tabId: 'settings-jobs' },
  { label: 'Dispatch groups', keywords: ['dispatch', 'crews'], tabId: 'settings-jobs' },
  { label: 'Job book', keywords: ['job numbering', 'job book settings'], tabId: 'settings-jobs' },
  // Catalogs & trades (dev + estimator)
  { label: 'Service types', keywords: ['trades', 'plumbing types'], tabId: 'settings-catalogs' },
  { label: 'Material part types', keywords: ['parts', 'materials catalog'], tabId: 'settings-catalogs' },
  { label: 'Material assembly types', keywords: ['assemblies'], tabId: 'settings-catalogs' },
  { label: 'Takeoff, Labor, and Price book names', keywords: ['books', 'price book', 'labor book', 'takeoff book'], tabId: 'settings-catalogs' },
  { label: 'Counts quick-add names', keywords: ['count sheet'], tabId: 'settings-catalogs' },
  { label: 'Duplicate materials', keywords: ['dedupe parts', 'find duplicates'], tabId: 'settings-catalogs' },
  { label: 'Company documents', keywords: ['docs', 'files', 'w9', 'insurance certificate'], tabId: 'settings-company' },
  // Templates & testing (dev)
  { label: 'Report templates', keywords: ['status report fields', 'report questions'], tabId: 'settings-templates' },
  { label: 'Email templates', keywords: ['resend', 'email design'], tabId: 'settings-templates' },
  { label: 'Easter eggs', keywords: ['floaty', 'fun'], tabId: 'settings-templates' },
  { label: 'Fix app', keywords: ['clear cache', 'stale bundle', 'white screen', 'reload'], tabId: 'settings-templates' },
  // Company
  { label: 'Office address', keywords: ['company address', 'shop address'], tabId: 'settings-company' },
  { label: 'Map default view', keywords: ['map center', 'map zoom'], tabId: 'settings-company' },
  // Jobs & billing (moved from Templates in v2.2088)
  { label: 'Invoice footers & issuer', keywords: ['stripe footer', 'paper invoice', 'invoice identity', 'billing footer'], tabId: 'settings-jobs' },
  { label: 'Bill-Customer memo', keywords: ['invoice memo', 'billing note'], tabId: 'settings-jobs' },
  // Bids (moved from Templates in v2.2088)
  { label: 'Bid cover letter defaults', keywords: ['cover letter', 'bid letter'], tabId: 'settings-catalogs', anchorId: 'settings-bid-cover-letter-defaults' },
  // The two estimate editors on Bids & materials, which Contracts & terms opens by anchor (punch list #181: every anchor the deep links know has a door).
  { label: 'Estimate defaults', keywords: ['estimate cx defaults', 'estimate email defaults', 'customer defaults', 'cx defaults'], tabId: 'settings-catalogs', anchorId: 'settings-estimate-cx-defaults' },
  { label: 'Estimate terms editor', keywords: ['public terms editor', 'edit the estimate terms', 'terms editor'], tabId: 'settings-catalogs', anchorId: 'settings-estimate-public-terms' },
  // People & teams
  { label: 'Team review cadence', keywords: ['reviews', 'feedback schedule'], tabId: 'settings-people' },
  // Advanced
  { label: 'Claim code', keywords: ['redeem code', 'advanced tools', 'dev code', 'probe'], tabId: 'settings-advanced-tools', anchorId: 'settings-claim-code' },
  // Guides
  { label: 'Help guides', keywords: ['how do i', 'help', 'documentation', 'manual'], tabId: 'settings-guides' },
  // The finder finds itself (v2.2902, J28-F4): "search" lands on the global-search guide.
  { label: 'Search for jobs, bids, customers, and estimates', keywords: ['search', 'global search', 'search bar', 'find job', 'find bid', 'find customer', 'find estimate', 'magnifier', 'cmd k', 'ctrl k'], tabId: 'settings-guides', guideSlug: 'global-search' },
  // Release notes
  { label: 'Release notes', keywords: ['app updates', "what's new", 'changelog', 'version'], tabId: 'settings-release-notes' },
]

export type SettingsSearchHit = {
  entry: SettingsSearchEntry
  /** Match position in the label for bolding; -1 for keyword-only matches. */
  matchStart: number
  matchLen: number
  /** The keyword that matched when the label didn't (shown as a hint). */
  matchedKeyword: string | null
}

/**
 * Ranked lookup: label prefix < label word-start < label substring < keyword.
 * Only entries whose tab is in `visibleTabIds` are returned (role safety).
 */
export function searchSettings(
  query: string,
  visibleTabIds: readonly string[],
  index: readonly SettingsSearchEntry[] = SETTINGS_SEARCH_INDEX,
  limit = 8,
): SettingsSearchHit[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  const visible = new Set(visibleTabIds)
  const scored: Array<{ hit: SettingsSearchHit; score: number; order: number }> = []
  index.forEach((entry, order) => {
    if (!visible.has(entry.tabId)) return
    const label = entry.label.toLowerCase()
    const pos = label.indexOf(q)
    if (pos === 0) {
      scored.push({ hit: { entry, matchStart: 0, matchLen: q.length, matchedKeyword: null }, score: 0, order })
      return
    }
    if (pos > 0) {
      const wordStart = label[pos - 1] === ' ' || label[pos - 1] === '-' || label[pos - 1] === ','
      scored.push({ hit: { entry, matchStart: pos, matchLen: q.length, matchedKeyword: null }, score: wordStart ? 1 : 2, order })
      return
    }
    const kw = (entry.keywords ?? []).find((k) => k.includes(q))
    if (kw) {
      scored.push({ hit: { entry, matchStart: -1, matchLen: 0, matchedKeyword: kw }, score: 3, order })
    }
  })
  scored.sort((a, b) => a.score - b.score || a.order - b.order)
  return scored.slice(0, limit).map((s) => s.hit)
}
/** How long a Settings anchor is held in view after it first appears, while the sections above it load. */
export const SETTINGS_ANCHOR_HOLD_MS = 6000

/** A drift under this many pixels is the anchor staying where it was put. */
export const SETTINGS_ANCHOR_DRIFT_PX = 8

/** A person scrolling or pressing anything takes the page back: the hold stops at once. */
const SETTINGS_ANCHOR_USER_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

/**
 * Scroll to a section anchor after its tab mounts, and hold it there while the page settles. The owning tab mounts
 * conditionally and its sections hydrate from async data, so the anchor can appear before the cards above it have
 * their height: one scroll lands it, and then a card above loads and pushes it off the screen (go anywhere, punch list
 * #181: the box's jump to Office hours left the card 875 px below the fold, while a fresh load of the same link
 * landed it). So, once the anchor exists, every tick re-aligns it when it has drifted, until the hold ends or the
 * person scrolls or presses anything themselves. Bounded: the anchor is looked for for `findMs`, held for
 * `holdMs`. Returns a stop function.
 */
export function pollScrollToSettingsAnchor(anchorId: string, opts: { findMs?: number; holdMs?: number } = {}): () => void {
  const findDeadline = Date.now() + (opts.findMs ?? 5000)
  let holdUntil = 0
  let aligned: number | null = null
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    for (const ev of SETTINGS_ANCHOR_USER_EVENTS) window.removeEventListener(ev, stop, true)
  }
  const align = (el: HTMLElement) => {
    el.scrollIntoView({ block: 'start', behavior: 'auto' })
    aligned = el.getBoundingClientRect().top
  }
  const tick = () => {
    if (stopped) return
    const el = document.getElementById(anchorId)
    if (!el) {
      if (Date.now() < findDeadline) window.setTimeout(tick, 120)
      else stop()
      return
    }
    if (holdUntil === 0) {
      holdUntil = Date.now() + (opts.holdMs ?? SETTINGS_ANCHOR_HOLD_MS)
      for (const ev of SETTINGS_ANCHOR_USER_EVENTS) window.addEventListener(ev, stop, { capture: true, passive: true })
      align(el)
    } else if (aligned != null && Math.abs(el.getBoundingClientRect().top - aligned) > SETTINGS_ANCHOR_DRIFT_PX) {
      align(el)
    }
    if (Date.now() < holdUntil) window.setTimeout(tick, 200)
    else stop()
  }
  window.setTimeout(tick, 120)
  return stop
}

/**
 * Query string that lands a guide-backed hit (v2.2902, J28-F4): the owning tab via the
 * `?tab=` deep link (so the Settings deep-link effect and the tab switch agree) plus the
 * GuideBrowser guide param. Other params are preserved. `null` for ordinary entries.
 */
export function settingsSearchGuideQuery(currentSearch: string, entry: SettingsSearchEntry): string | null {
  if (!entry.guideSlug) return null
  const params = new URLSearchParams(currentSearch)
  params.set('tab', entry.tabId)
  params.set(HELP_GUIDE_URL_PARAM, entry.guideSlug)
  return `?${params.toString()}`
}
