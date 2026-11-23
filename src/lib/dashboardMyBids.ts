import { getSubmissionSectionKey } from './bids/submissionSections'
import { compareBidsForBidBoardDueDate, compareBidsForBidBoardPendingRecency } from './compareBidsForBidBoardDueDate'
import { bidBoardDueCellParts, bidBoardNoDueDateParts } from './bids/bidBoardDateCells'

/**
 * Pure kernel for the Dashboard "My Bids" section (extracted from
 * src/pages/Dashboard.tsx as Stage A of the section extraction — see
 * docs/DASHBOARD_SECTIONS_ARCHITECTURE.md §10). Behavior-preserving:
 * the unread-flag computation, the "from others" update-list
 * build (filter/sort/bucket), and the section's pure formatters.
 */

/**
 * How the My Bids card opens on the first look of a load: folded to its heading
 * for a primary, whose list of old unsent bids pushed the rest of the Dashboard
 * down the page, open for every other role. The card keeps no memory of the
 * press, so a primary's card is folded again on the next load. A role that has
 * not arrived yet reads as open: the card folds when `primary` hydrates.
 */
export function myBidsStartsOpen(role: string | null | undefined): boolean {
  return role !== 'primary'
}

/** Dashboard My Bids: how many "from others" rows to add per "Show more" click. */
export const MY_BID_OTHERS_VISIBLE_STEP = 5

/**
 * Dashboard My Bids list: the most bids one read takes. The read sorts so the limit can only cut the
 * oldest decided bids (`MY_BIDS_READ_ORDER`), and `myBidsReadIsCut` says when it cut any.
 */
export const MY_BIDS_DASHBOARD_ROW_LIMIT = 50

/** A lost bid is never the card's: the first of the read's three keeps. */
export const MY_BIDS_NOT_LOST_FILTER = 'outcome.is.null,outcome.neq.lost'

/**
 * The read's third keep. **Archive from board** takes an unsent bid off the Bid Board's unsent pile
 * (`BidsBidBoardTab`: `k === 'unsent' && bid.working_board_archived_at`), so it leaves this card too.
 * A row is kept when it is not archived, or it has an answer, or it was sent. Punch list #426.
 */
export const MY_BIDS_ON_THE_BOARD_FILTER = 'working_board_archived_at.is.null,outcome.not.is.null,bid_date_sent.not.is.null'

/**
 * The order the read cuts in. Until punch list #426 it sorted by due date, oldest first, and took 50, so
 * a person with more lost their newest due dates and every bid with no due date. Now the bids with no
 * answer come first, then Won, then Started or Complete, each newest first, so a cut falls on the oldest
 * decided bids. The card sorts what it draws by itself (`groupMyBids`).
 */
export const MY_BIDS_READ_ORDER = [
  { column: 'outcome', ascending: false, nullsFirst: true },
  { column: 'created_at', ascending: false, nullsFirst: false },
] as const

/** True when the read came back full, so older bids may be left out. */
export function myBidsReadIsCut(rowCount: number): boolean {
  return rowCount >= MY_BIDS_DASHBOARD_ROW_LIMIT
}

/** The states a bid on the card can be in: the Bid Board's sections, less Lost, which the card never reads. */
export type MyBidState = 'unsent' | 'pending' | 'won' | 'startedOrComplete'

/** The states in the order a person works them, the Bid Board's own. */
export const MY_BID_STATES: readonly MyBidState[] = ['unsent', 'pending', 'won', 'startedOrComplete']

/** Each state in the Bid Board's words (`BID_BOARD_SECTION_CONFIG`; the board's unsent heading is *Unsent / Working Bids*). */
export const MY_BID_STATE_WORDS: Record<MyBidState, string> = {
  unsent: 'Unsent',
  pending: 'Not yet won or lost',
  won: 'Won',
  startedOrComplete: 'Started or Complete',
}

/**
 * A bid's state by the Bid Board's rule (`getSubmissionSectionKey`): the answer first, then the sent
 * date. The card read the sent date first until punch list #426, so a bid marked Won with no sent date
 * read *Unsent*. A lost bid is never read; one that slips through reads as its sent date says.
 */
export function myBidState(bid: { outcome: string | null; bid_date_sent: string | null }): MyBidState {
  const key = getSubmissionSectionKey(bid)
  if (key === 'won' || key === 'startedOrComplete' || key === 'unsent' || key === 'pending') return key
  return bid.bid_date_sent ? 'pending' : 'unsent'
}

/**
 * True for a bid the Bid Board no longer lists: one adopted into another bid's package, or an unsent
 * one archived from the board. The read filters both; this holds the rule for a row that arrives anyway.
 */
export function isMyBidOffTheBoard(bid: {
  outcome: string | null
  bid_date_sent: string | null
  working_board_archived_at?: string | null
  adopted_into_bid_id?: string | null
}): boolean {
  if (bid.adopted_into_bid_id) return true
  return Boolean(bid.working_board_archived_at) && myBidState(bid) === 'unsent'
}

/**
 * The bids by state, each pile in the Bid Board's order: Unsent by due date, oldest first, no due date
 * last (`compareBidsForBidBoardDueDate`); the rest by sent date, newest first
 * (`compareBidsForBidBoardPendingRecency`). Pure: new arrays out, the list given untouched.
 */
export function groupMyBids<T extends { id: string; outcome: string | null; bid_date_sent: string | null; bid_due_date: string | null }>(
  bids: readonly T[],
): Record<MyBidState, T[]> {
  const out: Record<MyBidState, T[]> = { unsent: [], pending: [], won: [], startedOrComplete: [] }
  for (const b of bids) out[myBidState(b)].push(b)
  out.unsent.sort(compareBidsForBidBoardDueDate)
  out.pending.sort(compareBidsForBidBoardPendingRecency)
  out.won.sort(compareBidsForBidBoardPendingRecency)
  out.startedOrComplete.sort(compareBidsForBidBoardPendingRecency)
  return out
}

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
  /** When the bid was made: the age of an unsent bid with no due date (`bidBoardNoDueDateParts`). */
  created_at: string | null
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
  created_at?: string | null
  working_board_archived_at?: string | null
  adopted_into_bid_id?: string | null
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
      created_at: r.created_at ?? null,
      service_type_name: r.service_type?.name ?? '',
      myBidRoles: myBidRolesForUser(userId, r.estimator_id, r.account_manager_id),
      unreadBidNotes: unreadBid,
      unreadCustomerNotes: unreadCust,
      othersBidUpdates,
      othersCustomerUpdates,
    }
  })
}

// ---------------------------------------------------------------------------
// The grouped card (punch list #426, step 2): the bids by state, one box a bid.
// ---------------------------------------------------------------------------

/** One line under each state's heading, shown while the group is open, for someone who has not seen the card in a while. */
export const MY_BID_STATE_GLOSS: Record<MyBidState, string> = {
  unsent: 'Still to price and send.',
  pending: 'Sent. Waiting on an answer.',
  won: 'The customer said yes.',
  startedOrComplete: 'The work is under way or done.',
}

/** The last group: the bids the person hid, in any state. */
export const MY_BIDS_HIDDEN_HEADING = 'Hidden'
export const MY_BIDS_HIDDEN_GLOSS = 'You hid these. Show again puts one back.'

/** The toast after a bid is hidden, with Undo beside it. */
export function myBidHiddenWords(name: string): string {
  return `Hidden: ${name}.`
}

/** The line under the groups when the read came back full (`myBidsReadIsCut`). */
export const MY_BIDS_CUT_WORDS = `Showing your newest ${MY_BIDS_DASHBOARD_ROW_LIMIT} bids. The Bid Board has every bid.`

/** The edge of a bid's box: red asks for a look now, amber soon, grey is the rest. The colours are the Needs you rows' (`NEEDS_YOU_RAIL`). */
export type MyBidTone = 'red' | 'amber' | 'gray'

/**
 * The value line of a bid: a label, the value, and the words after it.
 * *Due* **Wed 4/8** *229 days past due* · **No due date** *19 days on the board* · *Sent* **Fri 11/20** *3 days ago*.
 */
export type MyBidWhen = {
  /** `Due`, `Sent`, or null when the value says it all (*No due date*). */
  label: 'Due' | 'Sent' | null
  value: string
  /** The words after the value, or null when there is nothing to add. */
  tail: string | null
  /** True when the tail is itself the warning, so it draws in red. */
  late: boolean
  tone: MyBidTone
}

const daysWords = (n: number, tail: string): string => `${n} ${n === 1 ? 'day' : 'days'} ${tail}`

/**
 * When a bid is due or was sent, in the Bid Board's own rules. An unsent bid reads its due date:
 * red once it has passed, amber within `DUE_SOON_WINDOW_DAYS` (`bidBoardDueCellParts`). With no due
 * date it reads its days on the board, red after `UNSENT_NO_DUE_DATE_RED_AFTER_DAYS`
 * (`bidBoardNoDueDateParts`). Every other state reads its sent date and is never red: the deadline was
 * met. `today` is injectable for tests.
 */
export function myBidWhen(
  bid: { bid_due_date: string | null; bid_date_sent: string | null; outcome: string | null; created_at?: string | null },
  today: Date = new Date(),
): MyBidWhen {
  if (myBidState(bid) === 'unsent') {
    const due = bidBoardDueCellParts(bid.bid_due_date, today, bid.outcome, bid.bid_date_sent)
    if (due) {
      if (due.deltaDays > 0) return { label: 'Due', value: due.dateLabel, tail: daysWords(due.deltaDays, 'past due'), late: true, tone: 'red' }
      const tail = due.deltaDays === 0 ? 'today' : `in ${daysWords(-due.deltaDays, '').trim()}`
      return { label: 'Due', value: due.dateLabel, tail, late: false, tone: due.urgency === 'soon' ? 'amber' : 'gray' }
    }
    const none = bidBoardNoDueDateParts(bid, today)
    const late = none?.urgency === 'overdue'
    return {
      label: null,
      value: none?.label ?? 'No due date',
      tail: none?.ageDays != null ? daysWords(Math.max(0, none.ageDays), 'on the board') : null,
      late,
      tone: late ? 'red' : 'gray',
    }
  }
  const sent = bidBoardDueCellParts(bid.bid_date_sent, today)
  if (!sent) return { label: null, value: 'No sent date', tail: null, late: false, tone: 'gray' }
  const tail = sent.deltaDays <= 0 ? 'today' : daysWords(sent.deltaDays, 'ago')
  return { label: 'Sent', value: sent.dateLabel, tail, late: false, tone: 'gray' }
}

/** True while someone else's note on the bid has not been marked read. */
export function myBidHasUnread(bid: Pick<MyBidRow, 'unreadBidNotes' | 'unreadCustomerNotes'>): boolean {
  return bid.unreadBidNotes || bid.unreadCustomerNotes
}

/**
 * True when the bid is put away. A hidden bid with unread updates is drawn in its group until
 * **Mark read** (the owner's pick of 2026-11-23): before, the note on a hidden bid was never seen.
 */
export function myBidIsPutAway(bid: Pick<MyBidRow, 'id' | 'unreadBidNotes' | 'unreadCustomerNotes'>, hiddenIds: ReadonlySet<string>): boolean {
  return hiddenIds.has(bid.id) && !myBidHasUnread(bid)
}

export type MyBidGroup = {
  state: MyBidState
  heading: string
  gloss: string
  bids: MyBidRow[]
  /** Unsent bids whose due date has passed: *1 past due* on the heading. */
  pastDue: number
  /** Bids with unread updates: *1 unread* on the heading, and the bids a folded group still draws. */
  unread: MyBidRow[]
}

export type MyBidsCard = {
  /** The groups to draw, in order. A state with no bid is left out, except Unsent, which is always drawn. */
  groups: MyBidGroup[]
  /** The bids put away, in the order of the groups. */
  hidden: MyBidRow[]
  /** The number in the card's title: every bid not put away. The groups' counts add up to it. */
  shown: number
  /** True when the bids span more than one trade. While they share one, no row says it. */
  showTrade: boolean
}

/**
 * The card as it is drawn: the bids by state in the Bid Board's order, the ones put away last.
 * A stored hidden id that the read no longer holds counts for nothing, so the Hidden count is the
 * list under it.
 */
export function buildMyBidsCard(bids: readonly MyBidRow[], hiddenIds: ReadonlySet<string>, today: Date = new Date()): MyBidsCard {
  const shownBids = bids.filter((b) => !myBidIsPutAway(b, hiddenIds))
  const hiddenBids = bids.filter((b) => myBidIsPutAway(b, hiddenIds))
  const byState = groupMyBids(shownBids)
  const groups: MyBidGroup[] = []
  for (const state of MY_BID_STATES) {
    const list = byState[state]
    if (list.length === 0 && state !== 'unsent') continue
    groups.push({
      state,
      heading: MY_BID_STATE_WORDS[state],
      gloss: MY_BID_STATE_GLOSS[state],
      bids: list,
      pastDue: state === 'unsent' ? list.filter((b) => b.bid_due_date && myBidWhen(b, today).late).length : 0,
      unread: list.filter(myBidHasUnread),
    })
  }
  const hiddenByState = groupMyBids(hiddenBids)
  const trades = new Set(bids.map((b) => b.service_type_name).filter((t) => t !== ''))
  return {
    groups,
    hidden: MY_BID_STATES.flatMap((s) => hiddenByState[s]),
    shown: shownBids.length,
    showTrade: trades.size > 1,
  }
}

/** A group's heading for a screen reader: *Unsent, 3 bids, 1 past due, 1 unread*. */
export function myBidGroupLabel(g: Pick<MyBidGroup, 'heading' | 'bids' | 'pastDue' | 'unread'>): string {
  const parts = [g.heading, `${g.bids.length} ${g.bids.length === 1 ? 'bid' : 'bids'}`]
  if (g.pastDue > 0) parts.push(`${g.pastDue} past due`)
  if (g.unread.length > 0) parts.push(`${g.unread.length} unread`)
  return parts.join(', ')
}
