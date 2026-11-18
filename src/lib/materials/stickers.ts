/**
 * Stickers before boxes (punch list #329, v2.7072): the sticker's own words and verdicts. A sticker is a
 * printed code and a short number that point at one box, or at nothing yet (`box_stickers`,
 * `20261113020000_box_stickers.sql`). The code is cut from the sticker's own id by the rule a box's code
 * follows, so `labels.ts` reads and prints it; the number is what a person reads, `0147`. Pure: the reads
 * are in `onSiteStore.ts`, and no screen prints a run or places a sticker yet (PRs 2 and 3).
 *
 * Since v2.7438 (Taunya's call of 2026-11-16) the number is off the tape and off every screen: a sticker reads its
 * printed name when it has one and its code when it does not, and a sentence about one sticker says *this sticker*.
 * The number stays in the database, where it keeps a run in order and tells two stickers of one name apart.
 */
import { APP_CALENDAR_TZ, calendarYmdInAppTzFromIso } from '../../utils/dateUtils'
import { boxPageDayWords, boxPageKind, boxPageNameWords } from './boxPage'
import { dashedCode } from './labels'
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
  /** The box name printed large on the sticker, `G78` (section 10, v2.7312); null on a sticker that carries its number only. Left out by a reader from before the names. */
  boxName?: string | null
}

/** What a person reads off a sticker: its printed name when it carries one, its code with the dash when it does not. */
export function stickerSayName(sticker: Pick<StickerFacts, 'code' | 'boxName'>): string {
  return sticker.boxName || dashedCode(sticker.code)
}

/** Whether a sticker's printed name is the name of the box it is on: capitals and spaces do not matter. */
export function stickerNameIs(boxName: string | null | undefined, label: string | null | undefined): boolean {
  return !!boxName && !!label && boxName.trim().toUpperCase() === label.trim().toUpperCase()
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
    boxName: text(r.box_name)?.trim().toUpperCase() ?? null,
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

/**
 * *96 reserved and not on a box yet*. Empty when every sticker is on a box or lost. A named run's row adds which, by
 * name (`StickerRunsFold`). *Not used yet* until v2.7487: one name for the idea on every screen.
 */
export function unusedStickersWords(counts: Pick<StickerRunCounts, 'notUsed'>): string {
  if (counts.notUsed <= 0) return ''
  return `${counts.notUsed} reserved and not on a box yet`
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
  // The sentence already names the box, so the sticker is *this sticker*: no number, and never *Marcus put G78 on G78*.
  const n = 'this sticker'
  const N = 'This sticker'
  if (s.state === 'lost') {
    return { kind: 'lost', words: s.containerLabel ? `${N} was on ${s.containerLabel} and was marked lost.` : `${N} was marked lost.` }
  }
  if (s.state === 'on_box') {
    const box = s.containerLabel ?? 'a box'
    const ago = stickerAgoWords(s.placedAt, input.now)
    const tail = ago ? ` ${ago}` : ''
    const words = s.placedByName ? `${s.placedByName} put ${n} on ${box}${tail}.` : `${N} was put on ${box}${tail}.`
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
 *  - `retired_label`: a box's own label, on a box that was retired and that the reader may still see (v2.7630).
 *  - `out_of_reach`: a sticker on a box the reader's own RLS does not show, a job they are not on.
 *  - `none`: no sticker carries the code, and no box the reader may see does.
 */
export type CodeLookup =
  | { kind: 'box'; container: Container; sticker: StickerFacts | null }
  | { kind: 'blank'; sticker: StickerFacts }
  | { kind: 'lost'; sticker: StickerFacts }
  | { kind: 'retired'; sticker: StickerFacts }
  | { kind: 'retired_label'; container: Container }
  | { kind: 'out_of_reach'; sticker: StickerFacts }
  | { kind: 'none' }

/**
 * The verdict from what was read: the sticker the code names (null when none), the box that sticker is on as the
 * reader may see it, and the box whose own label carries the code, live or retired. The sticker wins, so a code means
 * one thing.
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
  if (input.ownBox) return input.ownBox.retiredAt ? { kind: 'retired_label', container: input.ownBox } : { kind: 'box', container: input.ownBox, sticker: null }
  return { kind: 'none' }
}

// ---------------------------------------------------------------------------
// The pages a scan opens
// ---------------------------------------------------------------------------

/**
 * A reserved sticker's heading with no sign-in: printed, with its own link, and on no box yet (`blank` in the code).
 * *Not on a box yet* until v2.7484, when the owner said printing a sticker reserves its place for a box filled in later.
 */
export const BLANK_STICKER_TITLE = 'This sticker is reserved for a box'

/** Under the heading: where it stands and the one thing to do. */
export const BLANK_STICKER_PUBLIC_DETAIL = 'It is not on a box yet. Sign in to say which box it is on.'

/** All a reserved sticker says with no sign-in. */
export const BLANK_STICKER_PUBLIC_WORDS = `${BLANK_STICKER_TITLE}. ${BLANK_STICKER_PUBLIC_DETAIL}`

/** Where a blank sticker goes, signed in (v2.7298, PR 3): the On site tab's Sticker is new sheet, on the job its run was printed for when there is one. */
export function blankStickerPath(sticker: Pick<StickerFacts, 'code' | 'runJobId'>): string {
  return `/tally?tab=on-site${sticker.runJobId ? `&job=${sticker.runJobId}` : ''}&sticker=${sticker.code}`
}

/** A lost sticker's heading. */
export const LOST_STICKER_TITLE = 'This sticker was marked lost'

/** Under a lost sticker's heading, signed in: the box it was on, when the reader may know it. */
export function lostStickerDetail(sticker: Pick<StickerFacts, 'containerLabel'>): string {
  return sticker.containerLabel ? `It was on ${sticker.containerLabel}. It no longer opens that box.` : 'It no longer opens a box.'
}

/**
 * A box label's own code that opens nothing for the person signed in (v2.7252). The page said the code *is not a box
 * on any job* and that the label *may be from a box that was retired*. It cannot know either: a box on a job the
 * reader is not on comes back as no row, the same as a retired box and a code nobody printed. So it says what it
 * knows, that the code opened no box for them, and both reasons.
 */
export function noBoxTitle(codeWords: string): string {
  return `${codeWords} did not open a box`
}
export const NO_BOX_DETAIL = 'The box may be on a job you are not on, or it may be retired. Ask the office, or open On site and find the box by its stencil.'

/**
 * A box's own label on a box that was retired, for a reader who may still see the box (v2.7630). Until then it read
 * *did not open a box* over both reasons, while the page with no sign-in named the box and said it was retired, so
 * someone signed in read less than a stranger. A retired box of a job the reader is not on still comes back as no
 * row, and `noBoxTitle` keeps its words for that.
 */
export function retiredLabelTitle(box: Pick<Container, 'kind' | 'label'>): string {
  return `${boxPageNameWords(boxPageKind(box.kind), box.label)} was retired`
}

/** Under it: the day the box left, and who brings one back. */
export function retiredLabelDetail(box: Pick<Container, 'retiredAt'>): string {
  const day = box.retiredAt ? boxPageDayWords(calendarYmdInAppTzFromIso(box.retiredAt)) : ''
  return `${day ? `It left the job on ${day}. ` : ''}The office brings a retired box back from the Retired fold on its Materials page.`
}

/** A sticker on a box of a job the reader is not on. */
export const OUT_OF_REACH_STICKER_TITLE = 'This sticker is on a box of a job you are not on'

/** A sticker on a box that was retired. */
export function retiredBoxStickerTitle(sticker: Pick<StickerFacts, 'containerLabel'>): string {
  return sticker.containerLabel ? `This sticker is on ${sticker.containerLabel}, which was retired` : 'This sticker is on a box that was retired'
}
