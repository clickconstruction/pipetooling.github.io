/**
 * The bids of the day (punch list #445, to-dos/clock-out-bids-of-the-day). At clock out the sheet lists the bids a
 * person worked on, read from what the app already keeps and never typed: their changes in the bid history ledger
 * and the beats a bid in front sends while the person is at work on it. This file turns the day's read
 * (`get_my_bid_day`) into that list, the strip above it, the sizes on its rows, the note the office reads and the
 * rows the press keeps. Pure.
 *
 * What a row claims: "worked on" is a bid the person changed. "Opened, nothing changed" is a bid that was in front
 * for a minute or more with no change of the person's. A size is rough and rounded, never a figure to bill by.
 */

import { SKY_UNDER_WORDS } from '../skyUnderWords'

/** One five-minute bucket of the person's changes on one bid. `app` is the app's own writes, such as a sync on open. */
export type BidDayChange = { bid_id: string; at: string; own: number; app: number; tables: string[] }
/** One five-minute bucket of beats for one bid on one Bids tab. */
export type BidDayBeat = { bid_id: string; tab: string; at: string; seconds: number }
export type BidDayKept = { bid_id: string; state: 'kept' | 'off'; source: 'app' | 'person'; saved_at?: string }
export type BidDaySession = { in: string; out: string | null }
export type BidDayBidName = { id: string; bid_number: string | null; project_name: string | null; service_type_id: string | null }

/** What `get_my_bid_day` answers. */
export type BidDayPayload = {
  day: string
  from: string
  to: string
  now: string
  changes: BidDayChange[]
  beats: BidDayBeat[]
  kept: BidDayKept[]
  sessions: BidDaySession[]
  bids: BidDayBidName[]
}

const BUCKET_MS = 5 * 60_000
const BUCKET_SECONDS = 300
/** A bid nobody changed shows as opened only once it was in front this long. */
export const OPENED_MIN_SECONDS = 60

/**
 * One colour a bid, the same on its block and on its row. Saturated on purpose: they read on both themes. The deep sky
 * is the kernel's (`skyUnderWords.test.ts` keeps that hex to its kernel, the stylesheet and one chart palette).
 */
export const BID_DAY_COLORS = ['#2563eb', '#0f766e', '#6d28d9', '#b45309', '#be123c', SKY_UNDER_WORDS, '#4d7c0f', '#a21caf'] as const

/** What the day holds for one bid, before the person has said anything. */
export type BidDayEvidence = {
  bidId: string
  /** worked: the person changed it. opened: it was in front and nothing of theirs changed. */
  kind: 'worked' | 'opened'
  /** Rough seconds at work on it. */
  seconds: number
  /** The person's own changes. */
  changes: number
  /** Tab keys, the most time first ('pricing', 'takeoffs', 'edit-bid'). */
  tabs: string[]
  /** Stretches of the day it filled, in ms, for the strip. */
  runs: Array<[number, number]>
  firstAt: number
  lastAt: number
}

export type BidDayRead = {
  day: string
  /** The strip's two ends, in ms: the day's first clock in (or first trace) to now (or the last clock out). */
  startMs: number
  endMs: number
  /** In the order each bid first shows in the day. */
  bids: BidDayEvidence[]
}

const TABLE_TAB: Record<string, string> = {
  bids_count_rows: 'counts',
  bid_count_sources: 'counts',
  bids_takeoff_rough_part_lines: 'takeoffs',
  bid_takeoff_stage_splits: 'takeoffs',
  cost_estimates: 'labor',
  cost_estimate_labor_rows: 'labor',
  cost_estimate_labor_rows_unmatched: 'labor',
  cost_estimate_waste_rows: 'labor',
  cost_estimate_subcontractor_rows: 'labor',
  cost_estimate_permit_rows: 'labor',
  cost_estimate_other_rows: 'labor',
  cost_estimate_equipment_rows: 'labor',
  bid_pricing_assignments: 'pricing',
  bid_count_row_custom_prices: 'pricing',
  bid_count_row_custom_costs: 'pricing',
  bid_rfqs: 'pricing',
  bid_sov_lines: 'cover-letter',
  bid_payment_schedule_rows: 'cover-letter',
  bids_submission_entries: 'submission-followup',
  bids: 'edit-bid',
  bid_versions: 'versions',
}

const TAB_LABEL: Record<string, string> = {
  counts: 'Counts',
  takeoffs: 'Takeoffs',
  labor: 'Labor',
  pricing: 'Pricing',
  'cover-letter': 'Cover Letter',
  submittals: 'Submittals',
  rfi: 'RFI',
  'change-order': 'Change Order',
  'lien-release': 'Lien Release',
  'submission-followup': 'Followup',
  'bid-board': 'Bid Board',
  'edit-bid': 'Edit bid',
  versions: 'Versions',
}

/** 'cover-letter' -> 'Cover Letter'. A key this file does not know is spelled out from its own letters. */
export function bidDayTabLabel(key: string): string {
  const known = TAB_LABEL[key]
  if (known) return known
  return key
    .split(/[_-]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/** The tabs of a row as words: the two it spent the most on, 'Takeoffs and Pricing'. '' for none. */
export function bidDayTabsLabel(tabs: readonly string[]): string {
  const labels = tabs.map(bidDayTabLabel).filter(Boolean).slice(0, 2)
  return labels.join(' and ')
}

/**
 * A rough size in words. Under ten minutes to the minute, under an hour to five minutes, and to the half hour
 * above that: '1 minute', '5 minutes', '40 minutes', '1 hour', '1.5 hours', '3 hours'.
 */
export function bidDaySize(seconds: number): string {
  const minutes = Math.max(0, seconds) / 60
  if (minutes < 9.5) {
    const m = Math.max(1, Math.round(minutes))
    return m === 1 ? '1 minute' : `${m} minutes`
  }
  if (minutes < 57.5) return `${Math.round(minutes / 5) * 5} minutes`
  const halves = Math.max(2, Math.round(minutes / 30))
  const hours = halves / 2
  return hours === 1 ? '1 hour' : `${hours} hours`
}

const ms = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : NaN
}
const bucketOf = (t: number): number => Math.floor(t / BUCKET_MS) * BUCKET_MS

/**
 * The seconds a bucket of changes stands for when no beat covers it (a beat is best effort, and there were none
 * before the beat shipped). A change proves the person was there at that moment and no more, so a lone bucket is a
 * minute. A bucket inside a run of changes is the whole five minutes, and the two ends of a run are half.
 */
function changeFloorSeconds(bucket: number, own: ReadonlySet<number>): number {
  const before = own.has(bucket - BUCKET_MS)
  const after = own.has(bucket + BUCKET_MS)
  if (before && after) return BUCKET_SECONDS
  if (before || after) return BUCKET_SECONDS / 2
  return 60
}

/** The day as evidence: one entry a bid, with its size, its tabs and where it sat in the day. */
export function readBidDay(payload: BidDayPayload | null | undefined): BidDayRead | null {
  if (!payload) return null
  type Acc = {
    beat: Map<number, number>
    own: Set<number>
    ownCount: number
    tabSeconds: Map<string, number>
    first: number
  }
  const byBid = new Map<string, Acc>()
  const acc = (bidId: string, at: number): Acc => {
    let a = byBid.get(bidId)
    if (!a) {
      a = { beat: new Map(), own: new Set(), ownCount: 0, tabSeconds: new Map(), first: at }
      byBid.set(bidId, a)
    }
    if (at < a.first) a.first = at
    return a
  }
  const addTab = (a: Acc, tab: string, seconds: number) => {
    if (!tab) return
    a.tabSeconds.set(tab, (a.tabSeconds.get(tab) ?? 0) + seconds)
  }

  for (const b of payload.beats ?? []) {
    const at = ms(b.at)
    if (!b.bid_id || Number.isNaN(at) || !(b.seconds > 0)) continue
    const bucket = bucketOf(at)
    const a = acc(b.bid_id, bucket)
    a.beat.set(bucket, Math.min(BUCKET_SECONDS, (a.beat.get(bucket) ?? 0) + b.seconds))
    addTab(a, b.tab, b.seconds)
  }
  for (const c of payload.changes ?? []) {
    const at = ms(c.at)
    if (!c.bid_id || Number.isNaN(at)) continue
    const bucket = bucketOf(at)
    if (!(c.own > 0)) {
      // The app's own write: the bid was opened. It shows only if beats give it a size.
      if (byBid.has(c.bid_id)) acc(c.bid_id, bucket)
      continue
    }
    const a = acc(c.bid_id, bucket)
    a.own.add(bucket)
    a.ownCount += c.own
    // A change names its tab only where no beat already did for this stretch.
    if (!a.beat.has(bucket)) for (const tab of new Set((c.tables ?? []).map((t) => TABLE_TAB[t] ?? ''))) addTab(a, tab, 60)
  }

  const bids: BidDayEvidence[] = []
  for (const [bidId, a] of byBid) {
    const buckets = new Map<number, number>()
    for (const [bucket, s] of a.beat) buckets.set(bucket, s)
    for (const bucket of a.own) buckets.set(bucket, Math.max(buckets.get(bucket) ?? 0, changeFloorSeconds(bucket, a.own)))
    const seconds = [...buckets.values()].reduce((s, v) => s + v, 0)
    const kind: BidDayEvidence['kind'] = a.ownCount > 0 ? 'worked' : 'opened'
    if (kind === 'opened' && seconds < OPENED_MIN_SECONDS) continue
    const sorted = [...buckets.keys()].sort((x, y) => x - y)
    const runs: Array<[number, number]> = []
    for (const bucket of sorted) {
      const last = runs[runs.length - 1]
      if (last && last[1] === bucket) last[1] = bucket + BUCKET_MS
      else runs.push([bucket, bucket + BUCKET_MS])
    }
    const tabs = [...a.tabSeconds.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([tab]) => tab)
    const firstAt = sorted[0] ?? a.first
    const lastAt = (sorted[sorted.length - 1] ?? a.first) + BUCKET_MS
    bids.push({ bidId, kind, seconds, changes: a.ownCount, tabs, runs, firstAt, lastAt })
  }
  bids.sort((x, y) => x.firstAt - y.firstAt || x.bidId.localeCompare(y.bidId))

  const now = ms(payload.now)
  const ins = (payload.sessions ?? []).map((s) => ms(s.in)).filter((t) => !Number.isNaN(t))
  const open = (payload.sessions ?? []).some((s) => !s.out)
  const outs = (payload.sessions ?? []).map((s) => ms(s.out)).filter((t) => !Number.isNaN(t))
  const firstTrace = bids.length ? Math.min(...bids.map((b) => b.firstAt)) : NaN
  const lastTrace = bids.length ? Math.max(...bids.map((b) => b.lastAt)) : NaN
  const starts = [...ins, firstTrace].filter((t) => !Number.isNaN(t))
  const startMs = starts.length ? Math.min(...starts) : ms(payload.from)
  const ends = [...outs, lastTrace].filter((t) => !Number.isNaN(t))
  const dayEnd = ms(payload.to)
  let endMs = open || !ends.length ? now : Math.max(...ends)
  if (Number.isNaN(endMs)) endMs = ends.length ? Math.max(...ends) : dayEnd
  if (!Number.isNaN(dayEnd)) endMs = Math.min(endMs, dayEnd)
  if (!(endMs > startMs)) endMs = startMs + BUCKET_MS
  return { day: payload.day, startMs, endMs, bids }
}

/** What the person has said about a bid: on the list, or off it. Absent means the app's own read stands. */
export type BidDayMarks = ReadonlyMap<string, 'kept' | 'off'>

/** The marks the day already holds, from an earlier clock out of the same day. */
export function bidDayMarksFromKept(kept: readonly BidDayKept[] | null | undefined): Map<string, 'kept' | 'off'> {
  const marks = new Map<string, 'kept' | 'off'>()
  for (const k of kept ?? []) if (k.bid_id) marks.set(k.bid_id, k.state === 'off' ? 'off' : 'kept')
  return marks
}

export type BidDayRow = {
  bidId: string
  name: string
  /** Shown beside the name when the bid opened a job: 'J1007'. */
  jobLabel: string | null
  /** True while the bid counts for the day. */
  kept: boolean
  /** '3 hours', or '' for a bid the app never saw. */
  size: string
  /** 'Takeoffs and Pricing', or 'Added by you' for a bid the app never saw. */
  where: string
  seconds: number | null
  changes: number
  tabs: string[]
  /** app: read from the day. person: added by the person, with nothing of it seen. */
  source: 'app' | 'person'
  /** The bid's colour, or null for a bid with no block on the strip. */
  color: string | null
}

export type BidDaySegment = { bidId: string; leftPct: number; widthPct: number; color: string; filled: boolean; name: string }

export type BidDayList = {
  /** Bids the person changed, plus any they added. */
  worked: BidDayRow[]
  /** Bids that were in front with nothing changed, not yet added. */
  opened: BidDayRow[]
  /** How many rows of `worked` still count. */
  keptCount: number
  strip: { startMs: number; endMs: number; segments: BidDaySegment[] }
  /** True when the day holds no bid at all: nothing read and nothing added. */
  empty: boolean
}

export type BidDayNames = {
  /** 'B412 · Ridgeway Clinic' for a bid id. */
  nameOf: (bidId: string) => string
  /** 'J1007' for a bid that opened a job, else null. */
  jobOf?: (bidId: string) => string | null
}

/**
 * The list the sheet draws. `marks` holds what the person said (a tick taken off, an opened bid ticked on), and
 * `added` the bids they added that the app never saw, in the order they added them.
 */
export function buildBidDayList(read: BidDayRead | null, marks: BidDayMarks, added: readonly string[], names: BidDayNames): BidDayList {
  const evidence = read?.bids ?? []
  const colorOf = new Map<string, string>()
  evidence.forEach((e, i) => colorOf.set(e.bidId, BID_DAY_COLORS[i % BID_DAY_COLORS.length] ?? BID_DAY_COLORS[0]))
  const rowOf = (e: BidDayEvidence, kept: boolean): BidDayRow => ({
    bidId: e.bidId,
    name: names.nameOf(e.bidId),
    jobLabel: names.jobOf?.(e.bidId) ?? null,
    kept,
    size: bidDaySize(e.seconds),
    where: bidDayTabsLabel(e.tabs),
    seconds: e.seconds,
    changes: e.changes,
    tabs: e.tabs.slice(0, 12),
    source: 'app',
    color: colorOf.get(e.bidId) ?? null,
  })

  const worked: BidDayRow[] = []
  const opened: BidDayRow[] = []
  const seen = new Set<string>()
  for (const e of evidence) {
    seen.add(e.bidId)
    const mark = marks.get(e.bidId)
    if (e.kind === 'worked') worked.push(rowOf(e, mark !== 'off'))
    else if (mark === 'kept') worked.push(rowOf(e, true))
    else opened.push(rowOf(e, false))
  }
  // A bid kept on an earlier clock out of the day that today's read no longer names, and the bids added now.
  const byHand = [...[...marks.keys()].filter((id) => !seen.has(id)), ...added.filter((id) => !seen.has(id) && !marks.has(id))]
  for (const bidId of byHand) {
    if (seen.has(bidId)) continue
    seen.add(bidId)
    worked.push({
      bidId,
      name: names.nameOf(bidId),
      jobLabel: names.jobOf?.(bidId) ?? null,
      kept: marks.get(bidId) !== 'off',
      size: '',
      where: 'Added by you',
      seconds: null,
      changes: 0,
      tabs: [],
      source: 'person',
      color: null,
    })
  }

  const startMs = read?.startMs ?? 0
  const endMs = read?.endMs ?? startMs + BUCKET_MS
  const span = Math.max(1, endMs - startMs)
  const keptIds = new Set(worked.filter((r) => r.kept).map((r) => r.bidId))
  const segments: BidDaySegment[] = []
  for (const e of evidence) {
    for (const [a, b] of e.runs) {
      const from = Math.max(a, startMs)
      const to = Math.min(b, endMs)
      if (!(to > from)) continue
      segments.push({
        bidId: e.bidId,
        leftPct: ((from - startMs) / span) * 100,
        widthPct: ((to - from) / span) * 100,
        color: colorOf.get(e.bidId) ?? BID_DAY_COLORS[0],
        filled: keptIds.has(e.bidId),
        name: names.nameOf(e.bidId),
      })
    }
  }
  return { worked, opened, keptCount: keptIds.size, strip: { startMs, endMs, segments }, empty: worked.length === 0 && opened.length === 0 }
}

/** A row's line: the size, then the tab. A row with no size shows its one fact alone. */
export function bidDayRowLine(row: Pick<BidDayRow, 'size' | 'where'>): string {
  if (!row.size) return row.where
  return row.where ? `${row.size} · ${row.where}` : row.size
}

/**
 * The note the clock session carries, one line a kept bid, then anything the person typed. It is what the office
 * reads beside the hours, in the place the typed note has always been.
 */
export function bidDayNote(list: Pick<BidDayList, 'worked'>, extra: string): string {
  const lines = list.worked
    .filter((r) => r.kept)
    .map((r) => {
      const name = r.jobLabel ? `${r.name} (${r.jobLabel})` : r.name
      const line = r.source === 'person' ? '' : bidDayRowLine(r).replace(' · ', ', ')
      return line ? `${name}: ${line}` : name
    })
  const typed = extra.trim()
  if (typed) lines.push(typed)
  return lines.join('\n')
}

/** One row of `save_my_bid_day`'s list. */
export type BidDayEntry = { bid_id: string; state: 'kept' | 'off'; source: 'app' | 'person'; seen_seconds: number | null; tabs: string[]; changes: number }

/** The rows the press keeps: every bid on the upper shelf, kept or taken off. An opened bid left alone is not kept. */
export function bidDayEntries(list: Pick<BidDayList, 'worked'>): BidDayEntry[] {
  return list.worked.map((r) => ({
    bid_id: r.bidId,
    state: r.kept ? 'kept' : 'off',
    source: r.source,
    seen_seconds: r.seconds == null ? null : Math.round(r.seconds),
    tabs: r.tabs,
    changes: r.changes,
  }))
}

/** The press says what it keeps: 'Complete clock out · 4 bids'. With no bid it is the verb alone. */
export function bidDayPressLabel(verb: string, kept: number): string {
  if (!(kept > 0)) return verb
  return `${verb} · ${kept} ${kept === 1 ? 'bid' : 'bids'}`
}
