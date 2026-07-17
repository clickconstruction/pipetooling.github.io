/**
 * Pure kernel for the Dashboard "My Bids" section (extracted from
 * src/pages/Dashboard.tsx as Stage A of the section extraction — see
 * docs/DASHBOARD_SECTIONS_ARCHITECTURE.md §10). Behavior-preserving:
 * the unread-flag computation, the "from others" update-list
 * build (filter/sort/bucket), and the section's pure formatters.
 */

/** Dashboard My Bids: how many "from others" rows to add per "Show more" click. */
export const MY_BID_OTHERS_VISIBLE_STEP = 5

/** Dashboard My Bids list: max rows (estimator match, non-lost), ordered by due date. */
export const MY_BIDS_DASHBOARD_ROW_LIMIT = 50

export type MyBidOthersBidItem = {
  id: string
  text: string | null
  createdAt: string
  occurredAt?: string | null
  contactMethod?: string | null
  authorLabel?: string
}

export type MyBidOthersCustomerItem = {
  id: string
  text: string | null
  createdAt: string
  contactDate?: string
  contactMethod?: string | null
  authorLabel?: string
}

export type MyBidRow = {
  id: string
  project_name: string | null
  bid_due_date: string | null
  bid_date_sent: string | null
  outcome: string | null
  service_type_name: string
  /** Current user's relationship to this bid on Dashboard My Bids. */
  myBidRoles: 'estimator' | 'account_manager' | 'both'
  unreadBidNotes: boolean
  unreadCustomerNotes: boolean
  othersBidUpdates: MyBidOthersBidItem[]
  othersCustomerUpdates: MyBidOthersCustomerItem[]
}

/** Raw `bids` row shape the My Bids loader selects. */
export type MyBidBaseRow = {
  id: string
  project_name: string | null
  bid_due_date: string | null
  bid_date_sent: string | null
  outcome: string | null
  customer_id: string | null
  estimator_id: string | null
  account_manager_id: string | null
  service_type: { name: string } | null
}

export type MyBidSubmissionEntryRow = {
  id: string
  bid_id: string
  created_at: string | null
  created_by: string | null
  notes: string | null
  occurred_at: string
  contact_method: string | null
}

export type MyBidCustomerContactRow = {
  id: string
  customer_id: string
  created_at: string | null
  created_by: string | null
  details: string | null
  contact_date: string
  contact_method: string | null
}

export type MyBidReadStateRow = {
  bid_id: string
  last_seen_bid_submission_at: string | null
  last_seen_customer_contact_at: string | null
}

/** Compact "time ago" for My Bids note summaries (e.g. 25m ago). */
export function formatRelativeCompactAgo(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const then = new Date(iso)
  const diffMs = now.getTime() - then.getTime()
  if (diffMs < 0) return 'just now'
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  const diffWeeks = Math.floor(diffMs / 604800000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  if (diffWeeks < 5) return `${diffWeeks}w ago`
  try {
    return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  } catch {
    return '—'
  }
}

/** Full date+time preview line for a My Bids note (e.g. "Jul 17, 26, 2:05 PM"). */
export function formatMyBidPreviewDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

/** One-line teaser for a My Bids note body (ellipsis past `max` chars). */
export function truncateMyBidNotePreview(text: string | null, max: number): string {
  if (!text?.trim()) return ''
  const t = text.trim()
  return t.length <= max ? t : `${t.slice(0, max)}…`
}

function compareSubmissionDesc(a: MyBidSubmissionEntryRow, b: MyBidSubmissionEntryRow): number {
  const ta = a.created_at ? Date.parse(a.created_at) : 0
  const tb = b.created_at ? Date.parse(b.created_at) : 0
  if (tb !== ta) return tb - ta
  return b.id.localeCompare(a.id)
}

function compareContactDesc(a: MyBidCustomerContactRow, b: MyBidCustomerContactRow): number {
  const ta = a.created_at ? Date.parse(a.created_at) : 0
  const tb = b.created_at ? Date.parse(b.created_at) : 0
  if (tb !== ta) return tb - ta
  return b.id.localeCompare(a.id)
}

/**
 * Bucket bid submission entries authored by OTHER users per bid, newest first
 * (created_at desc, id desc tiebreak). Entries by the viewer, with no author,
 * or with no created_at are dropped.
 */
export function bucketMyBidSubmissionsFromOthers(
  entryRows: MyBidSubmissionEntryRow[],
  userId: string,
): Map<string, MyBidSubmissionEntryRow[]> {
  const bidListsFromOthers = new Map<string, MyBidSubmissionEntryRow[]>()
  for (const row of entryRows) {
    if (!row.created_by || row.created_by === userId) continue
    const ca = row.created_at
    if (!ca) continue
    const list = bidListsFromOthers.get(row.bid_id)
    if (list) list.push(row)
    else bidListsFromOthers.set(row.bid_id, [row])
  }
  for (const list of bidListsFromOthers.values()) {
    list.sort(compareSubmissionDesc)
  }
  return bidListsFromOthers
}

/**
 * Bucket customer contacts authored by OTHER users per customer, newest first
 * (created_at desc, id desc tiebreak). Same drop rules as submissions.
 */
export function bucketMyBidCustomerContactsFromOthers(
  contactRows: MyBidCustomerContactRow[],
  userId: string,
): Map<string, MyBidCustomerContactRow[]> {
  const customerListsFromOthers = new Map<string, MyBidCustomerContactRow[]>()
  for (const row of contactRows) {
    if (!row.created_by || row.created_by === userId) continue
    const ca = row.created_at
    if (!ca) continue
    const cid = row.customer_id
    const list = customerListsFromOthers.get(cid)
    if (list) list.push(row)
    else customerListsFromOthers.set(cid, [row])
  }
  for (const list of customerListsFromOthers.values()) {
    list.sort(compareContactDesc)
  }
  return customerListsFromOthers
}

/** Distinct author ids across both "from others" bucket maps (for the users lookup). */
export function collectMyBidNoteAuthorIds(
  bidListsFromOthers: Map<string, MyBidSubmissionEntryRow[]>,
  customerListsFromOthers: Map<string, MyBidCustomerContactRow[]>,
): Set<string> {
  const authorIds = new Set<string>()
  for (const list of bidListsFromOthers.values()) {
    for (const e of list) {
      if (e.created_by) authorIds.add(e.created_by)
    }
  }
  for (const list of customerListsFromOthers.values()) {
    for (const c of list) {
      if (c.created_by) authorIds.add(c.created_by)
    }
  }
  return authorIds
}

/** Unread when there is a latest note and the watermark is missing or older than it. */
export function isMyBidStreamUnread(latest: string | undefined, wm: string | null | undefined): boolean {
  if (!latest) return false
  if (wm == null || wm === '') return true
  return Date.parse(latest) > Date.parse(wm)
}

/** The viewer's relationship to a bid (falls back to 'estimator' when neither matches). */
export function myBidRolesForUser(
  userId: string,
  estimatorId: string | null,
  accountManagerId: string | null,
): 'estimator' | 'account_manager' | 'both' {
  const isEstimator = estimatorId === userId
  const isAccountManager = accountManagerId === userId
  if (isEstimator && isAccountManager) return 'both'
  if (isEstimator) return 'estimator'
  if (isAccountManager) return 'account_manager'
  return 'estimator'
}

/**
 * Build the Dashboard My Bids rows from the loader's raw fetches: unread flags
 * per stream (vs the viewer's read-state watermarks) plus the "from others"
 * update lists with author labels.
 */
export function buildMyBidRows(params: {
  baseRows: MyBidBaseRow[]
  readStateRows: MyBidReadStateRow[]
  bidListsFromOthers: Map<string, MyBidSubmissionEntryRow[]>
  customerListsFromOthers: Map<string, MyBidCustomerContactRow[]>
  authorLabelById: Map<string, string>
  userId: string
}): MyBidRow[] {
  const { baseRows, readStateRows, bidListsFromOthers, customerListsFromOthers, authorLabelById, userId } = params

  const readMap = new Map<
    string,
    { last_seen_bid_submission_at: string | null; last_seen_customer_contact_at: string | null }
  >()
  for (const r of readStateRows) {
    readMap.set(r.bid_id, {
      last_seen_bid_submission_at: r.last_seen_bid_submission_at,
      last_seen_customer_contact_at: r.last_seen_customer_contact_at,
    })
  }

  return baseRows.map((r) => {
    const rs = readMap.get(r.id)
    const bidList = bidListsFromOthers.get(r.id) ?? []
    const latestBid = bidList[0]?.created_at ?? undefined
    const unreadBid = isMyBidStreamUnread(latestBid, rs?.last_seen_bid_submission_at)
    let unreadCust = false
    const custList = r.customer_id ? customerListsFromOthers.get(r.customer_id) ?? [] : []
    const latestC = custList[0]?.created_at ?? undefined
    if (r.customer_id) {
      unreadCust = isMyBidStreamUnread(latestC, rs?.last_seen_customer_contact_at)
    }

    const othersBidUpdates: MyBidOthersBidItem[] = bidList.map((e) => ({
      id: e.id,
      text: e.notes,
      createdAt: e.created_at ?? '',
      occurredAt: e.occurred_at,
      contactMethod: e.contact_method ?? undefined,
      authorLabel: e.created_by ? authorLabelById.get(e.created_by) : undefined,
    }))

    const othersCustomerUpdates: MyBidOthersCustomerItem[] = custList.map((c) => ({
      id: c.id,
      text: c.details,
      createdAt: c.created_at ?? '',
      contactDate: c.contact_date,
      contactMethod: c.contact_method ?? undefined,
      authorLabel: c.created_by ? authorLabelById.get(c.created_by) : undefined,
    }))

    return {
      id: r.id,
      project_name: r.project_name,
      bid_due_date: r.bid_due_date,
      bid_date_sent: r.bid_date_sent,
      outcome: r.outcome,
      service_type_name: r.service_type?.name ?? '',
      myBidRoles: myBidRolesForUser(userId, r.estimator_id, r.account_manager_id),
      unreadBidNotes: unreadBid,
      unreadCustomerNotes: unreadCust,
      othersBidUpdates,
      othersCustomerUpdates,
    }
  })
}
