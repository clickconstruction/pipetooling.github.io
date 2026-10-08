/**
 * Bid history, the reader (punch list #73, PR 2). `list_bid_history` returns the ledger's rows for a
 * bid (and every bid adopted into it), plus, for a dev, the delete archive's rows the ledger does
 * not hold. This kernel turns them into what the History window draws:
 *
 * - **Actions, not rows.** Each REST call is its own transaction and an import writes row by row,
 *   so rows group by burst: the same bid, the same person, the same request tag, each row within
 *   five seconds of the one before. An import of 23 rows reads as one action.
 * - **A caption from the action's shape**: the tag when there is one ("Imported 23 rows from
 *   CountTooling"), else what the rows did ("Removed SUMP and what hung on it", "Changed 3 prices").
 * - **One line per row**, in words: "Lav-1 · price · $9,800 → $10,300".
 * - **The tab** each change belongs to, for the window's filter, and a search over names and values.
 * - **Edit Bid's columns**: the owner left the default set to the builder (2026-10-08); the window
 *   shows `BID_HISTORY_DEFAULT_BID_COLUMNS` and counts the rest as "other fields".
 *
 * Pure: no IO, no clock but the `now` passed in.
 */
import { APP_CALENDAR_TZ, denverCalendarDayKey } from '../../utils/dateUtils'

export type BidHistoryOp = 'insert' | 'update' | 'delete'

/** One row as the window reads it (`list_bid_history`, camel-cased). */
export type BidHistoryRow = {
  /** 'ledger' = bid_changes; 'archive' = a removed row the ledger does not hold (kept 90 days). */
  source: 'ledger' | 'archive'
  id: number | null
  archiveId: string | null
  bidId: string
  bidNumber: string | null
  table: string
  recordId: string
  countRowId: string | null
  op: BidHistoryOp
  changed: string[]
  oldValues: Record<string, unknown> | null
  newValues: Record<string, unknown> | null
  label: string | null
  changedBy: string | null
  changedByName: string | null
  changedAt: string
  action: string | null
  byApp: boolean | null
}

/** The RPC's row as PostgREST returns it. */
export type BidHistoryRpcRow = {
  source: string
  id: number | null
  archive_id: string | null
  bid_id: string
  bid_number: string | null
  table_name: string
  record_id: string
  count_row_id: string | null
  op: string
  changed: string[] | null
  old_values: unknown
  new_values: unknown
  label: string | null
  changed_by: string | null
  changed_by_name: string | null
  changed_at: string
  action: string | null
  by_app: boolean | null
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null

export function bidHistoryRowFromRpc(r: BidHistoryRpcRow): BidHistoryRow {
  return {
    source: r.source === 'archive' ? 'archive' : 'ledger',
    id: r.id ?? null,
    archiveId: r.archive_id ?? null,
    bidId: r.bid_id,
    bidNumber: r.bid_number ?? null,
    table: r.table_name,
    recordId: r.record_id,
    countRowId: r.count_row_id ?? null,
    op: r.op === 'insert' || r.op === 'delete' ? r.op : 'update',
    changed: r.changed ?? [],
    oldValues: asRecord(r.old_values),
    newValues: asRecord(r.new_values),
    label: r.label ?? null,
    changedBy: r.changed_by ?? null,
    changedByName: r.changed_by_name ?? null,
    changedAt: r.changed_at,
    action: r.action ?? null,
    byApp: r.by_app ?? null,
  }
}

// ---------------------------------------------------------------------------
// Where a change belongs, and what its columns are called
// ---------------------------------------------------------------------------

export type BidHistoryTab = 'counts' | 'takeoffs' | 'labor' | 'pricing' | 'cover-letter' | 'edit-bid' | 'versions'

export const BID_HISTORY_TABS: ReadonlyArray<{ key: BidHistoryTab; label: string }> = [
  { key: 'counts', label: 'Counts' },
  { key: 'takeoffs', label: 'Takeoffs' },
  { key: 'labor', label: 'Labor' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'cover-letter', label: 'Cover Letter' },
  { key: 'edit-bid', label: 'Edit bid' },
  { key: 'versions', label: 'Versions' },
]

const COVER_LETTER_BID_COLUMN = /^(cover_letter_|sov_|include_(materials_by_stage|payment_schedule|schedule_of_values)$)/
const PRICING_BID_COLUMN = /^selected_(price|labor|takeoff)_book_version_id$/

/** The tab a change belongs to: its table's, and for a `bids` row its first column's. */
export function bidHistoryTabOf(row: Pick<BidHistoryRow, 'table' | 'changed'>): BidHistoryTab {
  switch (row.table) {
    case 'bids_count_rows':
      return 'counts'
    case 'bids_takeoff_rough_part_lines':
    case 'bid_takeoff_stage_splits':
      return 'takeoffs'
    case 'bid_count_row_custom_prices':
    case 'bid_count_row_custom_costs':
    case 'bid_pricing_assignments':
      return 'pricing'
    case 'bid_sov_lines':
    case 'bid_payment_schedule_rows':
      return 'cover-letter'
    case 'bid_versions':
      return 'versions'
    case 'bids': {
      const first = row.changed[0] ?? ''
      if (COVER_LETTER_BID_COLUMN.test(first)) return 'cover-letter'
      if (PRICING_BID_COLUMN.test(first)) return 'pricing'
      return 'edit-bid'
    }
    default:
      return row.table.startsWith('cost_estimate') ? 'labor' : 'edit-bid'
  }
}

/**
 * The bids columns an Edit Bid change shows by default (the owner left the set to the builder,
 * 2026-10-08): what a person types or picks about the bid itself. The robot, board and version
 * picks stay out; the window counts them as "other fields".
 */
export const BID_HISTORY_DEFAULT_BID_COLUMNS: ReadonlyArray<string> = [
  'project_name',
  'address',
  'customer_id',
  'estimator_id',
  'account_manager_id',
  'bid_due_date',
  'bid_due_time',
  'bid_date_sent',
  'bid_value',
  'agreed_value',
  'outcome',
  'loss_reason',
  'notes',
  'cover_letter_inclusions',
  'cover_letter_exclusions',
  'cover_letter_terms',
]

const COLUMN_NAMES: Record<string, string> = {
  project_name: 'project',
  customer_id: 'GC',
  gc_builder_id: 'GC',
  estimator_id: 'estimator',
  account_manager_id: 'account man',
  bid_due_date: 'due',
  bid_due_time: 'due time',
  bid_date_sent: 'sent',
  bid_value: 'value',
  agreed_value: 'agreed value',
  loss_reason: 'loss reason',
  cover_letter_inclusions: 'inclusions',
  cover_letter_exclusions: 'exclusions',
  cover_letter_terms: 'terms',
  selected_price_book_version_id: 'price book',
  selected_labor_book_version_id: 'labor book',
  selected_takeoff_book_version_id: 'takeoff book',
  selected_bid_version_id: 'active version',
  unit_price: 'price',
  unit_materials_cents: 'quoted cost',
  price_book_entry_id: 'book entry',
  rough_in_hrs_per_unit: 'rough in hours',
  top_out_hrs_per_unit: 'top out hours',
  trim_set_hrs_per_unit: 'trim set hours',
  rough_in: 'rough in',
  top_out: 'top out',
  trim_set: 'trim set',
  labor_rate: 'labor rate',
  group_tag: 'group',
}

/** A column's name in words: the map's, else the column with its `_id` and underscores gone. */
export function bidHistoryColumnName(column: string): string {
  return COLUMN_NAMES[column] ?? column.replace(/_id$/, '').replace(/_/g, ' ')
}

type ValueKind = 'money' | 'cents' | 'hours' | 'pick' | 'date' | 'plain'

function kindOf(column: string): ValueKind {
  if (column.endsWith('_cents')) return 'cents'
  if (/_hrs_per_unit$|^hours/.test(column)) return 'hours'
  if (column.endsWith('_id')) return 'pick'
  if (/(_date|_at)$|^bid_date_sent$/.test(column)) return 'date'
  if (/(price|value|cost|rate|amount|profit)$|^(rough_in|top_out|trim_set)$/.test(column)) return 'money'
  return 'plain'
}

const money = (n: number) =>
  `${n < 0 ? '-' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`

/** A value in words: money with a dollar sign, hours with h, a date as "Oct 3", an id as "a pick", text in quotes. */
export function bidHistoryValueWords(column: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  const kind = kindOf(column)
  if (typeof value === 'boolean') return value ? 'yes' : 'no'
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : '—'
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value)) ? Number(value) : null
  if (kind === 'cents' && n != null) return money(n / 100)
  if (kind === 'money' && n != null) return money(n)
  if (kind === 'hours' && n != null) return `${n} h`
  if (kind === 'pick') return 'a pick'
  if (kind === 'date' && typeof value === 'string') {
    const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value)
    if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(value) ? 'UTC' : APP_CALENDAR_TZ })
  }
  if (n != null) return n.toLocaleString('en-US', { maximumFractionDigits: 2 })
  const text = String(value).replace(/\s+/g, ' ').trim()
  return `“${text.length > 60 ? `${text.slice(0, 57)}…` : text}”`
}

// ---------------------------------------------------------------------------
// One row in words
// ---------------------------------------------------------------------------

export type BidHistoryLine = {
  key: string
  /** "Lav-1", or the column for a bids row. */
  subject: string
  /** "price · $9,800 → $10,300", "added · count 4", "removed". */
  detail: string
  /** The bid number when the window shows an adopted bid's rows too. */
  bidNumber: string | null
  /** True for a row the archive holds (removed before the ledger, or by an older path). */
  fromArchive: boolean
  /** An update's line: the column it is about (what Put back writes). */
  column?: string
}

const STAMP_COLUMNS = new Set(['id', 'bid_id', 'bid_version_id', 'count_row_id', 'cost_estimate_id', 'created_at', 'updated_at', 'sequence_order', 'sort_order', 'labor_row_id', 'parked_at'])

/** The columns a line shows: for a `bids` row only the default set (the rest counted apart). */
export function bidHistoryShownColumns(row: Pick<BidHistoryRow, 'table' | 'changed'>): { shown: string[]; others: number } {
  const changed = row.changed.filter((c) => !STAMP_COLUMNS.has(c))
  if (row.table !== 'bids') return { shown: changed, others: 0 }
  const shown = changed.filter((c) => BID_HISTORY_DEFAULT_BID_COLUMNS.includes(c))
  return { shown, others: changed.length - shown.length }
}

/** The row's lines: one per shown column for an update, one for an insert or a removal. */
export function bidHistoryLines(row: BidHistoryRow): BidHistoryLine[] {
  const base = { bidNumber: row.bidNumber, fromArchive: row.source === 'archive' }
  const subject = row.table === 'bids' ? 'Bid' : row.label?.trim() || bidHistoryColumnName(row.table.replace(/^bids?_/, '').replace(/_rows?$/, ''))
  const key = `${row.source}-${row.id ?? row.archiveId}`
  const { shown, others } = bidHistoryShownColumns(row)
  if (row.op === 'update') {
    const lines: BidHistoryLine[] = shown.map((c) => ({
      ...base,
      key: `${key}-${c}`,
      column: c,
      subject,
      detail: `${bidHistoryColumnName(c)} · ${bidHistoryValueWords(c, row.oldValues?.[c])} → ${bidHistoryValueWords(c, row.newValues?.[c])}`,
    }))
    if (others > 0) lines.push({ ...base, key: `${key}-others`, subject, detail: `${others} other ${others === 1 ? 'field' : 'fields'}` })
    return lines
  }
  const values = row.op === 'insert' ? row.newValues : row.oldValues
  const lead = ['count', 'unit_price', 'unit_materials_cents', 'quantity', 'value', 'rough_in_hrs_per_unit'].find((c) => values?.[c] != null)
  const verb = row.op === 'insert' ? 'added' : row.source === 'archive' ? 'removed · kept 90 days' : 'removed'
  return [{ ...base, key, subject, detail: lead ? `${verb} · ${bidHistoryColumnName(lead)} ${bidHistoryValueWords(lead, values?.[lead])}` : verb }]
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export const BID_HISTORY_BURST_MS = 5000

export type BidHistoryAction = {
  key: string
  bidId: string
  bidNumber: string | null
  /** Who: the person's name, "the app" for its own writes, "the robot", or "someone". */
  who: string
  /** The person's id, for the window's filter (null for the app and the robots). */
  whoId: string | null
  tab: BidHistoryTab
  caption: string
  startedAt: string
  endedAt: string
  rows: BidHistoryRow[]
  fromArchive: boolean
}

const sameTag = (a: string | null, b: string | null) => (a ?? '') === (b ?? '')

/** Who wrote a row, in words. */
export function bidHistoryWho(row: Pick<BidHistoryRow, 'changedBy' | 'changedByName' | 'byApp' | 'action'>): string {
  if (row.action === 'robot-paste') return 'the robot'
  if (row.byApp) return 'the app'
  if (row.changedByName?.trim()) return row.changedByName.trim()
  return row.changedBy ? 'someone' : 'the app'
}

/**
 * An action's tab: its rows' one tab; with several, Counts when a count row is among them (a fixture
 * removed with its takeoff parts and labor is a Counts action), else the tab most of its rows are on.
 */
function actionTab(rows: ReadonlyArray<BidHistoryRow>, tabs: ReadonlySet<BidHistoryTab>): BidHistoryTab {
  if (tabs.size === 1) return [...tabs][0]!
  if (tabs.has('counts')) return 'counts'
  const tally = new Map<BidHistoryTab, number>()
  for (const r of rows) tally.set(bidHistoryTabOf(r), (tally.get(bidHistoryTabOf(r)) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0]![0]
}

/** Group rows (any order) into actions, newest first: same bid, author, tag and source, rows within five seconds. */
export function groupBidHistory(rows: ReadonlyArray<BidHistoryRow>): BidHistoryAction[] {
  const ordered = [...rows].sort((a, b) => a.changedAt.localeCompare(b.changedAt) || (a.id ?? 0) - (b.id ?? 0))
  const groups: BidHistoryRow[][] = []
  for (const row of ordered) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    const joins =
      prev &&
      prev.bidId === row.bidId &&
      prev.changedBy === row.changedBy &&
      sameTag(prev.action, row.action) &&
      prev.source === row.source &&
      Date.parse(row.changedAt) - Date.parse(prev.changedAt) <= BID_HISTORY_BURST_MS
    if (joins) last!.push(row)
    else groups.push([row])
  }
  return groups
    .map((g) => {
      const first = g[0]!
      const tabs = new Set(g.map(bidHistoryTabOf))
      return {
        key: `${first.source}-${first.id ?? first.archiveId}`,
        bidId: first.bidId,
        bidNumber: first.bidNumber,
        who: bidHistoryWho(first),
        whoId: first.byApp || first.action === 'robot-paste' ? null : first.changedBy,
        tab: actionTab(g, tabs),
        caption: bidHistoryCaption(g),
        startedAt: first.changedAt,
        endedAt: g[g.length - 1]!.changedAt,
        rows: g,
        fromArchive: first.source === 'archive',
      }
    })
    .reverse()
}

const NOUNS: Record<string, [string, string]> = {
  bids_count_rows: ['count row', 'count rows'],
  bids_takeoff_rough_part_lines: ['takeoff part', 'takeoff parts'],
  bid_takeoff_stage_splits: ['stage split', 'stage splits'],
  bid_count_row_custom_prices: ['price', 'prices'],
  bid_count_row_custom_costs: ['quoted cost', 'quoted costs'],
  bid_pricing_assignments: ['book pick', 'book picks'],
  cost_estimate_labor_rows: ['labor row', 'labor rows'],
  cost_estimate_labor_rows_unmatched: ['set-aside labor row', 'set-aside labor rows'],
  bid_sov_lines: ['schedule line', 'schedule lines'],
  bid_payment_schedule_rows: ['payment line', 'payment lines'],
  bid_versions: ['version', 'versions'],
}
const noun = (table: string, n: number) => {
  const [one, many] = NOUNS[table] ?? ['row', 'rows']
  return `${n} ${n === 1 ? one : many}`
}

/** An action's one line: from its tag when it has one, else from what its rows did. */
export function bidHistoryCaption(rows: ReadonlyArray<BidHistoryRow>): string {
  const first = rows[0]!
  const countRowInserts = rows.filter((r) => r.table === 'bids_count_rows' && r.op === 'insert').length
  const countRowDeletes = rows.filter((r) => r.table === 'bids_count_rows' && r.op === 'delete')
  const labor = (op: BidHistoryOp) => rows.filter((r) => r.table.startsWith('cost_estimate_labor_rows') && r.op === op).length
  switch (first.action) {
    case 'counts-import':
      return countRowInserts ? `Imported ${noun('bids_count_rows', countRowInserts).replace('count row', 'row')} from CountTooling` : 'Imported from CountTooling'
    case 'counts-clear-all':
      return countRowDeletes.length ? `Cleared all counts (${noun('bids_count_rows', countRowDeletes.length)})` : 'Cleared all counts'
    case 'robot-paste':
      return countRowInserts ? `The robot pasted ${noun('bids_count_rows', countRowInserts)}` : 'The robot pasted its counts'
    case 'book-fill':
      return `Filled ${noun('bid_pricing_assignments', rows.filter((r) => r.table === 'bid_pricing_assignments' && r.op === 'insert').length || rows.length)} from the book`
    case 'labor-sync':
      return 'Labor matched to the counts'
    case 'labor-rename':
      return `Kept ${noun('cost_estimate_labor_rows', labor('update'))} through a rename`
    case 'labor-park':
      return `Set aside ${noun('cost_estimate_labor_rows', labor('delete') || labor('insert'))} no fixture claims`
    case 'labor-take-back':
      return `Took back ${noun('cost_estimate_labor_rows', labor('insert') || labor('delete'))} set aside before`
    case 'labor-use-parked':
      return 'Used set-aside hours on a fixture'
    case 'put-back': {
      // History's Put back (PR 4): one value per press, so the caption names it.
      if (rows.length > 1) return `Put back ${rows.length} values`
      const col = first.changed.find((c) => !STAMP_COLUMNS.has(c))
      return `Put back ${first.table === 'bids' ? 'Bid' : first.label?.trim() || 'a value'}${col ? ` ${bidHistoryColumnName(col)}` : ''}`
    }
  }
  const ops = new Set(rows.map((r) => r.op))
  const tables = new Set(rows.map((r) => r.table))
  if (ops.size === 1 && ops.has('delete')) {
    if (countRowDeletes.length === 1) {
      const name = countRowDeletes[0]!.label?.trim() || 'a count row'
      return rows.length > 1 ? `Removed ${name} and what hung on it` : `Removed ${name}`
    }
    if (countRowDeletes.length > 1) return `Removed ${noun('bids_count_rows', countRowDeletes.length)} and what hung on them`
    if (tables.size === 1) return rows.length === 1 && first.label?.trim() ? `Removed ${first.label.trim()}` : `Removed ${noun(first.table, rows.length)}`
    return `Removed ${rows.length} rows`
  }
  if (ops.size === 1 && ops.has('insert')) {
    if (tables.size === 1) return rows.length === 1 && first.label?.trim() ? `Added ${first.label.trim()}` : `Added ${noun(first.table, rows.length)}`
    if (countRowInserts) return `Added ${noun('bids_count_rows', countRowInserts)} and what hangs on them`
    return `Added ${rows.length} rows`
  }
  if (ops.size === 1 && ops.has('update')) {
    if (tables.size === 1 && first.table === 'bids') {
      const cols = [...new Set(rows.flatMap((r) => bidHistoryShownColumns(r).shown))].map(bidHistoryColumnName)
      // The default columns when it touched any; else the ones it did touch (a version switch reads
      // "Edit Bid · active version", not "other fields").
      const touched = [...new Set(rows.flatMap((r) => r.changed.filter((c) => !STAMP_COLUMNS.has(c))))]
      const named = (cols.length ? cols : touched.map(bidHistoryColumnName))
      return named.length ? `Edit Bid · ${named.length > 3 ? `${named.slice(0, 3).join(', ')} and ${named.length - 3} more` : named.join(' and ')}` : 'Edit Bid'
    }
    if (rows.length === 1) {
      const col = first.changed.find((c) => !STAMP_COLUMNS.has(c))
      return `Changed ${first.label?.trim() || 'a row'}${col ? ` ${bidHistoryColumnName(col)}` : ''}`
    }
    if (tables.size === 1) return `Changed ${noun(first.table, rows.length)}`
    return `Changed ${rows.length} values`
  }
  return `${rows.length} changes`
}

// ---------------------------------------------------------------------------
// Filters, search, days
// ---------------------------------------------------------------------------

export type BidHistoryFilter = { tab: BidHistoryTab | null; whoId: string | null | 'app'; search: string }

/** The actions the window shows: a tab, a person (or "the app"), and a search over names and values. */
export function filterBidHistory(actions: ReadonlyArray<BidHistoryAction>, filter: BidHistoryFilter): BidHistoryAction[] {
  const q = filter.search.trim().toLowerCase()
  return actions.filter((a) => {
    if (filter.tab && !a.rows.some((r) => bidHistoryTabOf(r) === filter.tab)) return false
    if (filter.whoId === 'app' ? a.whoId !== null : filter.whoId && a.whoId !== filter.whoId) return false
    if (!q) return true
    if (a.caption.toLowerCase().includes(q)) return true
    return a.rows.some((r) => bidHistoryLines(r).some((l) => `${l.subject} ${l.detail} ${l.bidNumber ?? ''}`.toLowerCase().includes(q)))
  })
}

/** The people (and the app) who wrote anything, most actions first: the window's person chips. */
export function bidHistoryAuthors(actions: ReadonlyArray<BidHistoryAction>): Array<{ whoId: string | 'app'; who: string; count: number }> {
  const by = new Map<string, { whoId: string | 'app'; who: string; count: number }>()
  for (const a of actions) {
    const k = a.whoId ?? 'app'
    const cur = by.get(k) ?? { whoId: k, who: a.whoId ? a.who : 'the app and robots', count: 0 }
    cur.count += 1
    by.set(k, cur)
  }
  return [...by.values()].sort((x, y) => y.count - x.count || x.who.localeCompare(y.who))
}

/** The company's calendar day of an instant (the app's one day key, locale-data-proof). */
const dayKey = (iso: string) => denverCalendarDayKey(Date.parse(iso))

/** The day heading an action sits under: "Today", "Yesterday", a weekday within the week, else "Mon, Sep 29". */
export function bidHistoryDayLabel(iso: string, now: Date): string {
  const day = dayKey(iso)
  const today = dayKey(now.toISOString())
  if (day === today) return 'Today'
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString())
  if (day === yesterday) return 'Yesterday'
  const d = new Date(iso)
  const diffDays = (Date.parse(`${today}T12:00:00Z`) - Date.parse(`${day}T12:00:00Z`)) / 86_400_000
  if (diffDays < 7) return d.toLocaleDateString('en-US', { weekday: 'long', timeZone: APP_CALENDAR_TZ })
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })
}

/** "8:14 pm" in the company's time. */
export function bidHistoryTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: APP_CALENDAR_TZ }).replace(' AM', ' am').replace(' PM', ' pm')
}

/** Actions under their day headings, newest day first. */
export function bidHistoryByDay(actions: ReadonlyArray<BidHistoryAction>, now: Date): Array<{ day: string; actions: BidHistoryAction[] }> {
  const out: Array<{ day: string; actions: BidHistoryAction[] }> = []
  for (const a of actions) {
    const day = bidHistoryDayLabel(a.endedAt, now)
    const last = out[out.length - 1]
    if (last && last.day === day) last.actions.push(a)
    else out.push({ day, actions: [a] })
  }
  return out
}
