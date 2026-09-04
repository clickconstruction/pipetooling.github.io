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

export type SettingsSearchEntry = {
  /** Display label — the setting/section name as the page shows it. */
  label: string
  /** Extra match words (lowercase): synonyms, old names, what people type. */
  keywords?: string[]
  /** Owning tab/group id from getSettingsJumpGroups. */
  tabId: string
  /** DOM id to scroll to after the tab opens (only ids that really exist). */
  anchorId?: string
}

export const SETTINGS_SEARCH_INDEX: readonly SettingsSearchEntry[] = [
  // What customers see (v2.2758)
  { label: 'What customers see', keywords: ['customer view', 'sample customer', 'estimate email preview', 'bid room preview', 'portal preview', 'journeys', 'what the customer sees'], tabId: 'settings-what-customers-see' },
  // Notifications
  { label: 'Push notifications', keywords: ['alerts', 'phone notifications', 'enable notifications'], tabId: 'settings-recent-push' },
  { label: 'Recent emails sent', keywords: ['email log', 'sent mail'], tabId: 'settings-recent-push', anchorId: 'settings-recent-emails' },
  // Your account
  { label: 'My profile', keywords: ['name', 'password', 'email address', 'account'], tabId: 'settings-account' },
  { label: 'Salaried workday', keywords: ['salary', 'auto clock', 'work schedule'], tabId: 'settings-account', anchorId: 'settings-salary-workday' },
  { label: 'Personal time off', keywords: ['pto', 'vacation', 'time off', 'holiday'], tabId: 'settings-account', anchorId: 'settings-salary-workday' },
  { label: 'Page pins', keywords: ['pinned pages', 'pins'], tabId: 'settings-account' },
  { label: 'Back up my data', keywords: ['backup', 'export', 'download my data'], tabId: 'settings-account' },
  // Dashboard & alerts
  { label: 'Dashboard quick buttons', keywords: ['quick add', 'new job button', 'shortcuts'], tabId: 'settings-dashboard' },
  { label: 'Quick-Add Task icon', keywords: ['add task', 'home screen'], tabId: 'settings-dashboard' },
  { label: 'Daily goals', keywords: ['goals', 'checklist goals'], tabId: 'settings-dashboard' },
  { label: 'Report notifications', keywords: ['field reports', 'report emails'], tabId: 'settings-dashboard' },
  { label: 'My reports', keywords: ['report subscriptions', 'email reports'], tabId: 'settings-dashboard' },
  { label: 'Financial pins', keywords: ['billed pin', 'sub labor due', 'supply houses ap', 'internal team labor', 'money pins'], tabId: 'settings-dashboard' },
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
  // Data & migration (dev)
  { label: 'Backups & exports', keywords: ['backup', 'export data', 'csv'], tabId: 'settings-data' },
  { label: 'Recently deleted', keywords: ['trash', 'restore', 'undelete', 'deleted records'], tabId: 'settings-data', anchorId: 'settings-recently-deleted' },
  { label: 'Bulk-deletion alert', keywords: ['mass delete', 'deletion warning'], tabId: 'settings-data' },
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
  { label: 'Bid cover letter defaults', keywords: ['cover letter', 'bid letter'], tabId: 'settings-catalogs' },
  // People & teams
  { label: 'Team review cadence', keywords: ['reviews', 'feedback schedule'], tabId: 'settings-people' },
  // Advanced
  { label: 'Claim code', keywords: ['redeem code', 'advanced tools'], tabId: 'settings-advanced-tools' },
  // Guides
  { label: 'Help guides', keywords: ['how do i', 'help', 'documentation', 'manual'], tabId: 'settings-guides' },
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
/**
 * Scroll to a section anchor after its tab mounts — same bounded polling the
 * Settings deep-link effect uses (sections hydrate from async data, so the
 * element can appear well after the tab switch).
 */
export function pollScrollToSettingsAnchor(anchorId: string): void {
  const deadline = Date.now() + 5000
  const scrollNow = () => {
    const el = document.getElementById(anchorId)
    if (el) el.scrollIntoView({ block: 'start', behavior: 'auto' })
    return el != null
  }
  const tick = () => {
    if (scrollNow()) {
      // Sections above the anchor hydrate from async data and push it down
      // after the first scroll — re-align a couple of times as things settle.
      window.setTimeout(scrollNow, 700)
      window.setTimeout(scrollNow, 1800)
      return
    }
    if (Date.now() < deadline) window.setTimeout(tick, 120)
  }
  window.setTimeout(tick, 120)
}
