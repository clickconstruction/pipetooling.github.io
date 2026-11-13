/**
 * Stickers before boxes (punch list #329, v2.7072): the sticker's own words and verdicts. A sticker is a
 * printed code and a short number that point at one box, or at nothing yet (`box_stickers`,
 * `20261113020000_box_stickers.sql`). The code is cut from the sticker's own id by the rule a box's code
 * follows, so `labels.ts` reads and prints it; the number is what a person reads, `0147`. Pure: the reads
 * are in `onSiteStore.ts`, and no screen prints a run or places a sticker yet (PRs 2 and 3).
 */
import { APP_CALENDAR_TZ } from '../../utils/dateUtils'
import type { Container } from './onSite'

/** Blank points at no box. A lost one keeps the box it was on and no longer opens it. */
export type StickerState = 'blank' | 'on_box' | 'lost'

/** One sticker as `sticker_by_code` and `box_sticker_facts` answer it: the little a scan needs before it knows the job. */
export type StickerFacts = {
  id: string
  number: number
  code: string
  state: StickerState
  /** The box it is on, or was on when it was marked lost. */
  containerId: string | null
  containerLabel: string | null
  containerKind: string | null
  containerRetiredAt: string | null
  /** The job of that box. */
  jobId: string | null
  placedByName: string | null
  placedAt: string | null
  lostAt: string | null
  runId: string | null
  /** The job the sticker's run was printed for: where a new box made from it lands. */
  runJobId: string | null
}

/** The number as printed: `0147`. Four digits, and five past 9999. The database's twin is `box_sticker_number_words`. */
export function stickerNumberWords(number: number): string {
  const n = Math.max(0, Math.round(Number.isFinite(number) ? number : 0))
  return String(n).padStart(4, '0')
}

/** A run's numbers: `0101 to 0300`. One sticker reads as its number alone. */
export function stickerRangeWords(first: number, last: number): string {
  return first === last ? stickerNumberWords(first) : `${stickerNumberWords(first)} to ${stickerNumberWords(last)}`
}

/** A new box's name until someone types one: its sticker's number (call 7). `place_sticker` writes the same. */
export function stickerBoxName(number: number): string {
  return stickerNumberWords(number)
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

/** The function's answer read back; null when it is not a sticker. */
export function stickerFactsOf(raw: unknown): StickerFacts | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const number = typeof r.number === 'number' ? r.number : Number.NaN
  if (typeof r.id !== 'string' || !Number.isInteger(number) || number < 1 || typeof r.code !== 'string') return null
  const state: StickerState | null = r.state === 'blank' || r.state === 'on_box' || r.state === 'lost' ? r.state : null
  if (!state) return null
  return {
    id: r.id,
    number,
    code: r.code,
    state,
    containerId: text(r.container_id),
    containerLabel: text(r.container_label),
    containerKind: text(r.container_kind),
    containerRetiredAt: text(r.container_retired_at),
    jobId: text(r.job_id),
    placedByName: text(r.placed_by_name),
    placedAt: text(r.placed_at),
    lostAt: text(r.lost_at),
    runId: text(r.run_id),
    runJobId: text(r.run_job_id),
  }
}

// ---------------------------------------------------------------------------
// A run's counts
// ---------------------------------------------------------------------------

/** The part of a sticker row a count reads. */
export type StickerCountRow = { number: number; containerId: string | null; lostAt: string | null }

export type StickerRange = { first: number; last: number }

export type StickerRunCounts = {
  total: number
  /** On a box and not lost. */
  onBoxes: number
  /** Blank: on no box and not lost. */
  notUsed: number
  lost: number
  /** The blank ones as unbroken ranges, lowest first. */
  unused: StickerRange[]
}

/** How a run stands: on boxes, not used, lost, and the numbers still free. */
export function stickerRunCounts(stickers: ReadonlyArray<StickerCountRow>): StickerRunCounts {
  let onBoxes = 0
  let lost = 0
  const blank: number[] = []
  for (const s of stickers) {
    if (s.lostAt) lost += 1
    else if (s.containerId) onBoxes += 1
    else blank.push(s.number)
  }
  blank.sort((a, b) => a - b)
  const unused: StickerRange[] = []
  for (const n of blank) {
    const open = unused[unused.length - 1]
    if (open && n === open.last + 1) open.last = n
    else if (!open || n !== open.last) unused.push({ first: n, last: n })
  }
  return { total: stickers.length, onBoxes, notUsed: blank.length, lost, unused }
}

/** The ranges a line can name before it reads as a list. */
const UNUSED_RANGES_NAMED = 3

/** *96 stickers not used yet, 0205 to 0300*. Empty when every sticker is used. */
export function unusedStickersWords(counts: Pick<StickerRunCounts, 'notUsed' | 'unused'>): string {
  if (counts.notUsed <= 0 || counts.unused.length === 0) return ''
  const head = counts.notUsed === 1 ? '1 sticker not used yet' : `${counts.notUsed} stickers not used yet`
  const ranges = counts.unused.map((r) => stickerRangeWords(r.first, r.last))
  if (ranges.length === 1) return `${head}, ${ranges[0]}`
  if (ranges.length <= UNUSED_RANGES_NAMED) return `${head}, ${ranges.slice(0, -1).join(', ')} and ${ranges[ranges.length - 1]}`
  const first = counts.unused[0]!.first
  const last = counts.unused[counts.unused.length - 1]!.last
  return `${head}, between ${stickerNumberWords(first)} and ${stickerNumberWords(last)}`
}

/** *104 of 200 stickers are on boxes*. */
export function onBoxesWords(counts: Pick<StickerRunCounts, 'total' | 'onBoxes'>): string {
  return counts.total === 1 ? `${counts.onBoxes} of 1 sticker is on a box` : `${counts.onBoxes} of ${counts.total} stickers are on boxes`
}

// ---------------------------------------------------------------------------
// The placing verdicts
// ---------------------------------------------------------------------------

/**
 * How long ago, as a person says it: *a minute ago*, *12 minutes ago*, *an hour ago*, *yesterday*, then the day.
 * Empty when either instant does not read.
 */
export function stickerAgoWords(atIso: string | null, nowIso: string): string {
  const at = atIso ? Date.parse(atIso) : Number.NaN
  const now = Date.parse(nowIso)
  if (!Number.isFinite(at) || !Number.isFinite(now)) return ''
  const mins = Math.floor(Math.max(0, now - at) / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 2) return 'a minute ago'
  if (mins < 60) return `${mins} minutes ago`
  const hours = Math.floor(mins / 60)
  if (hours < 2) return 'an hour ago'
  if (hours < 24) return `${hours} hours ago`
  if (hours < 48) return 'yesterday'
  return `on ${new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: APP_CALENDAR_TZ })}`
}

/**
 * What a scan of a sticker means for someone about to place it:
 *  - `blank`: it takes a box.
 *  - `other_job`: blank, and printed for another job than the one the person is on. It asks once.
 *  - `on_box`: someone already put it on a box, with who and when.
 *  - `lost`: it was marked lost.
 */
export type PlacingVerdict =
  | { kind: 'blank' }
  | { kind: 'other_job'; words: string }
  | { kind: 'on_box'; words: string; containerId: string | null; jobId: string | null }
  | { kind: 'lost'; words: string }

export function placingVerdict(input: {
  sticker: StickerFacts
  /** The job the person is standing on, when the screen knows it. */
  hereJobId?: string | null
  /** The name of the job the run was printed for, when the reader may see it. */
  runJobName?: string | null
  now: string
}): PlacingVerdict {
  const s = input.sticker
  const n = stickerNumberWords(s.number)
  if (s.state === 'lost') {
    return { kind: 'lost', words: s.containerLabel ? `${n} was on ${s.containerLabel} and was marked lost.` : `${n} was marked lost.` }
  }
  if (s.state === 'on_box') {
    const box = s.containerLabel ?? 'a box'
    const ago = stickerAgoWords(s.placedAt, input.now)
    const tail = ago ? ` ${ago}` : ''
    const words = s.placedByName ? `${s.placedByName} put ${n} on ${box}${tail}.` : `${n} was put on ${box}${tail}.`
    return { kind: 'on_box', words, containerId: s.containerId, jobId: s.jobId }
  }
  if (s.runJobId && input.hereJobId && s.runJobId !== input.hereJobId) {
    const job = (input.runJobName ?? '').trim() || 'another job'
    return { kind: 'other_job', words: `This sticker was printed for ${job}. Use it here?` }
  }
  return { kind: 'blank' }
}

// ---------------------------------------------------------------------------
// One resolver: what a scanned or typed code names
// ---------------------------------------------------------------------------

/**
 * What a code opens for someone signed in. A sticker's code is read first, then a box's own:
 *  - `box`: a live box, by its own label (`sticker` null) or by a sticker on it.
 *  - `blank`: a sticker on no box yet.
 *  - `lost`: a sticker that was marked lost.
 *  - `retired`: a sticker on a box that was retired.
 *  - `out_of_reach`: a sticker on a box the reader's own RLS does not show, a job they are not on.
 *  - `none`: no sticker and no live box carries the code.
 */
export type CodeLookup =
  | { kind: 'box'; container: Container; sticker: StickerFacts | null }
  | { kind: 'blank'; sticker: StickerFacts }
  | { kind: 'lost'; sticker: StickerFacts }
  | { kind: 'retired'; sticker: StickerFacts }
  | { kind: 'out_of_reach'; sticker: StickerFacts }
  | { kind: 'none' }

/**
 * The verdict from what was read: the sticker the code names (null when none), the box that sticker is on as the
 * reader may see it, and the live box whose own label carries the code. The sticker wins, so a code means one thing.
 */
export function codeLookup(input: { sticker: StickerFacts | null; stickerBox: Container | null; ownBox: Container | null }): CodeLookup {
  const s = input.sticker
  if (s) {
    if (s.state === 'lost') return { kind: 'lost', sticker: s }
    if (s.state === 'blank' || !s.containerId) return { kind: 'blank', sticker: s }
    if (s.containerRetiredAt || input.stickerBox?.retiredAt) return { kind: 'retired', sticker: s }
    if (!input.stickerBox) return { kind: 'out_of_reach', sticker: s }
    return { kind: 'box', container: input.stickerBox, sticker: s }
  }
  if (input.ownBox && !input.ownBox.retiredAt) return { kind: 'box', container: input.ownBox, sticker: null }
  return { kind: 'none' }
}

// ---------------------------------------------------------------------------
// The pages a scan opens
// ---------------------------------------------------------------------------

/** A blank sticker's heading, signed in and signed out. */
export function blankStickerTitle(number: number): string {
  return `Sticker ${stickerNumberWords(number)} is not on a box yet`
}

/** All a blank sticker says with no sign-in. */
export function blankStickerPublicWords(number: number): string {
  return `${blankStickerTitle(number)}. Sign in to say what it is.`
}

/** A lost sticker's heading. */
export function lostStickerTitle(number: number): string {
  return `Sticker ${stickerNumberWords(number)} was marked lost`
}

/** Under a lost sticker's heading, signed in: the box it was on, when the reader may know it. */
export function lostStickerDetail(sticker: Pick<StickerFacts, 'containerLabel'>): string {
  return sticker.containerLabel ? `It was on ${sticker.containerLabel}. It no longer opens that box.` : 'It no longer opens a box.'
}

/** A sticker on a box of a job the reader is not on. */
export function outOfReachStickerTitle(number: number): string {
  return `Sticker ${stickerNumberWords(number)} is on a box of a job you are not on`
}

/** A sticker on a box that was retired. */
export function retiredBoxStickerTitle(sticker: Pick<StickerFacts, 'number' | 'containerLabel'>): string {
  const n = stickerNumberWords(sticker.number)
  return sticker.containerLabel ? `Sticker ${n} is on ${sticker.containerLabel}, which was retired` : `Sticker ${n} is on a box that was retired`
}
