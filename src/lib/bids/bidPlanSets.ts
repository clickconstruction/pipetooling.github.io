/**
 * Plan sets on a bid (v2.6169; the table is v2.6168): a bid carries more than one set of plans — the
 * issued set, an addendum, a permit set, a GC's marked copy — each with its own name, memo, date and
 * Drive link, and the file's name and size as `plan-fetch`'s probe read them. `bids.plans_link` stays
 * the set the robot reads and the Plans panel searches; a bid whose link is on none of its rows reads
 * as one set, the link on the bid itself, so an old bid draws as it always did and nothing was
 * backfilled. The Bid Board's plans icon opens one set directly and offers two or more in a picker.
 */
export type BidPlanSetRow = {
  id: string
  bid_id: string
  name: string
  memo: string
  plan_date: string | null
  link: string
  file_name: string | null
  file_size: number | null
  file_count: number | null
  checked_at: string | null
  check_note: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  /** The bid version this set was bid from (v2.6230): set when an adopted bid brought it; absent or null = the bid as a whole. */
  bid_version_id?: string | null
}

/** Every column: `*`, so a read stands before the version column's migration is pushed and after. */
export const BID_PLAN_SET_SELECT = '*'

/** The chip beside a set or a CountTooling project that came with an adopted bid: *version · William · April set*. */
export function versionChipWords(name: string | null | undefined): string {
  const n = (name ?? '').trim()
  return n ? `version · ${n}` : ''
}

/** One set as the board and the form draw it: a row, or the bid's own plans link standing in for one. */
export type PlanSetItem = {
  id: string
  name: string
  memo: string
  /** `YYYY-MM-DD`, the set's own civil date. */
  planDate: string | null
  link: string
  fileName: string | null
  fileSize: number | null
  fileCount: number | null
  checkedAt: string | null
  checkNote: string | null
  /** The set's link is the bid's `plans_link`: the robot reads this one. */
  robotReads: boolean
  /** No row of its own: the bid's `plans_link` with no set recorded for it. */
  onBid: boolean
}

/** The id the bid's own plans link wears when it stands in for a set. */
export const BID_OWN_PLANS_SET_ID = 'bid-plans-link'

/** The name the bid's own link reads under when no row names it. */
export const BID_OWN_PLANS_SET_NAME = 'Plans'

/** Two links are the same set when they differ only by surrounding space, a trailing slash or Drive's `?usp=` tail. */
export function samePlanLink(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (s: string | null | undefined) => (s ?? '').trim().replace(/[?&]usp=[^&#]*/g, '').replace(/\?$/, '').replace(/\/+$/, '')
  const x = n(a)
  return x.length > 0 && x === n(b)
}

function itemFromRow(row: BidPlanSetRow, robotLink: string | null): PlanSetItem {
  return {
    id: row.id,
    name: row.name,
    memo: row.memo ?? '',
    planDate: row.plan_date,
    link: row.link,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileCount: row.file_count,
    checkedAt: row.checked_at,
    checkNote: row.check_note,
    robotReads: samePlanLink(row.link, robotLink),
    onBid: false,
  }
}

/** Newest date first; a set with no date after the dated ones; the newest made first among equals. */
export function comparePlanSets(a: Pick<BidPlanSetRow, 'plan_date' | 'created_at'>, b: Pick<BidPlanSetRow, 'plan_date' | 'created_at'>): number {
  if (a.plan_date && b.plan_date && a.plan_date !== b.plan_date) return a.plan_date < b.plan_date ? 1 : -1
  if (a.plan_date && !b.plan_date) return -1
  if (!a.plan_date && b.plan_date) return 1
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
}

/**
 * The sets a bid offers: its rows, newest first, and — when the bid's own plans link is on none of
 * them — that link as one more set at the end, named *Plans*. An empty list means the bid has no plans.
 */
export function planSetsForBid(rows: ReadonlyArray<BidPlanSetRow>, bid: { plans_link: string | null }): PlanSetItem[] {
  const robotLink = (bid.plans_link ?? '').trim() || null
  const items = [...rows].sort(comparePlanSets).map((r) => itemFromRow(r, robotLink))
  if (robotLink && !items.some((i) => i.robotReads)) {
    items.push({ id: BID_OWN_PLANS_SET_ID, name: BID_OWN_PLANS_SET_NAME, memo: '', planDate: null, link: robotLink, fileName: null, fileSize: null, fileCount: null, checkedAt: null, checkNote: null, robotReads: true, onBid: true })
  }
  return items
}

/** What the board's plans icon does: nothing to draw, open the one set, or offer the picker. */
export function planSetsPress(items: ReadonlyArray<PlanSetItem>): 'none' | 'open' | 'pick' {
  return items.length === 0 ? 'none' : items.length === 1 ? 'open' : 'pick'
}

/** The icon's title: the one set by name, or how many there are to pick from. */
export function planSetsIconTitle(items: ReadonlyArray<PlanSetItem>): string {
  if (items.length === 1) return items[0]!.onBid ? 'Job plans' : `Job plans · ${items[0]!.name}`
  return `Job plans · ${items.length} sets`
}

/** Bytes as people read them: *860 KB*, *2.1 MB*, *42 MB*, *1.2 GB*. Null for nothing known. */
export function formatPlanSetBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null
  if (bytes < 1024) return `${Math.round(bytes)} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 10) return `${mb.toFixed(1)} MB`
  if (mb < 1024) return `${Math.round(mb)} MB`
  const gb = mb / 1024
  return `${gb < 10 ? gb.toFixed(1) : Math.round(gb)} GB`
}

/** The set's date as people read it: *Oct 2, 2026*. A civil date, read by its parts, so no zone shifts it. */
export function planSetDateWords(ymd: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd ?? '')
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * What stands behind the link, in one line: *3 PDFs · 42 MB*, *A-101.pdf · 2.1 MB*, *Not read yet*, or
 * the probe's reason when it could not open the link.
 */
export function planSetFileWords(item: Pick<PlanSetItem, 'fileName' | 'fileSize' | 'fileCount' | 'checkedAt' | 'checkNote'>): string {
  const size = formatPlanSetBytes(item.fileSize)
  if (item.fileCount != null && item.fileCount > 1) return `${item.fileCount} PDFs${size ? ` · ${size}` : ''}`
  if (item.fileName) return `${item.fileName}${size ? ` · ${size}` : ''}`
  if (item.checkNote) return `Could not read the link: ${item.checkNote}`
  if (item.checkedAt) return 'Nothing readable behind the link'
  return 'Not read yet'
}

/** The probe's answer (`plan-fetch` `probe_url`) as the columns a set keeps. */
export function planSetFileFromProbe(r: { readable: boolean; note?: string | null; name?: string | null; size?: number | null; count?: number | null }, now: Date = new Date()): Pick<BidPlanSetRow, 'file_name' | 'file_size' | 'file_count' | 'checked_at' | 'check_note'> {
  return {
    file_name: r.name ?? null,
    file_size: typeof r.size === 'number' && Number.isFinite(r.size) ? r.size : null,
    file_count: typeof r.count === 'number' && Number.isFinite(r.count) ? r.count : null,
    checked_at: now.toISOString(),
    check_note: r.readable ? null : r.note ?? 'could not read the link',
  }
}

/** What a new or edited set still needs before it saves; null when it can. */
export function planSetDraftProblem(draft: { name: string; link: string }): string | null {
  if (!draft.name.trim()) return 'Give the set a name.'
  if (!/^https?:\/\//i.test(draft.link.trim())) return 'Paste the set’s link, starting with https://'
  return null
}

/** The count the board's icon carries: only when there is a choice to make. */
export function planSetsIconCount(items: ReadonlyArray<PlanSetItem>): string | null {
  return items.length >= 2 ? String(items.length) : null
}
