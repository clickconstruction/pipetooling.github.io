/**
 * Stickers before boxes (punch list #329, PR 3, v2.7298): the first scan. A signed-in scan of a blank sticker opens
 * the On site tab on one sheet, **Sticker G78 is new**, with two branches: **It is on a box I know**, a match list of
 * the development's live boxes (this job's first, the boxes with no sticker first, searched by stencil, place, where
 * line and parts), each row a press that puts the sticker on that box through `place_sticker`; and **It is a new
 * box**, the box made in the same `place_sticker` call, named by the site's next free name (`boxName.ts`, the owner's
 * change to call 7 on 2026-11-14: never the sticker's number).
 *
 * Since v2.7438 (Taunya's call of 2026-11-16) a sticker's running number is in none of these words: a sticker is its
 * printed name, or *this sticker*, and Scan a label takes the eight characters of a code and nothing shorter.
 *
 * Pure: the sheet's words, the match list's order and search, the answer read back and said, what a row says of
 * its stickers, the count of stickers not yet on a box, and what a typed scan means (a code or a number). The reads
 * and the one write are `stickerPlaceIo.ts`; the sheet is `StickerNewSheet.tsx`.
 */
import { nameTakenBy, type SiteBox } from './boxName'
import { compareLabels, type Container, type ContainerLine, type Place } from './onSite'
import type { OnSiteFindJob } from './onSiteFind'
import { markCountsWords, NO_MARK, reservedMarkOf, type ReservedMark } from './stickerMark'
import { namesSpanWords, nextTwinName } from './stickerNames'
import { placingVerdict, stickerFactsOf, stickerNameIs, type StickerCountRow, type StickerFacts } from './stickers'

// ---------------------------------------------------------------------------
// The sheet's words
// ---------------------------------------------------------------------------

/** The sheet's heading: a named sticker by the name on its tape, *Sticker G78 is new* (section 10, PR 9); one with no name, *This sticker is new*. */
export function stickerNewTitle(sticker: Pick<StickerFacts, 'boxName'>): string {
  return sticker.boxName ? `Sticker ${sticker.boxName} is new` : 'This sticker is new'
}

/** Under the list, when a named sticker's name is a box on the site already and the box in hand is another one. */
export const STICKER_DIFFERENT_BOX_LABEL = 'It is a different box'

/**
 * How the sheet opens for a sticker (section 10, PR 9). A sticker with a name reads it off the tape: when the site
 * has a live box of that name the sheet opens on **It is on a box I know** with that box picked, and **It is a
 * different box** offers the next letter at the spot (`nextTwinName`: G78B, or G78C when G78B stands); when the site
 * has none it opens on **It is a new box** with the name filled in. A sticker with a number only opens as before:
 * `branch` null, so the boxes decide (`defaultBranch`).
 */
export type StickerOpening = {
  branch: StickerBranch | null
  /** The site's live box that carries the sticker's name, to pick in the list. */
  pickId: string | null
  /** The name the new box opens on: the sticker's own when the site has no box of it. */
  offerName: string | null
  /** The name **It is a different box** opens the new box on; null when there is no box of the name, or no letter left. */
  twinName: string | null
}

export function stickerOpening(sticker: Pick<StickerFacts, 'boxName'>, siteBoxes: ReadonlyArray<SiteBox>): StickerOpening {
  const name = sticker.boxName?.trim().toUpperCase() || null
  if (!name) return { branch: null, pickId: null, offerName: null, twinName: null }
  const taken = nameTakenBy(siteBoxes, name)
  if (!taken) return { branch: 'new', pickId: null, offerName: name, twinName: null }
  return { branch: 'known', pickId: taken.id ?? null, offerName: null, twinName: nextTwinName(siteBoxes, name) }
}

/** Said over the list when the sheet opened on the box of the sticker's name: *G12 is a box on this site already.* */
export function nameIsHereWords(name: string): string {
  return `${name} is a box on this site already.`
}

/** Said under the new box's name when it is not the name on the tape (after **It is a different box**, or a typed name): the two will differ, and a scan says so. */
export function twinNoteWords(stickerName: string, boxName: string): string {
  return `The sticker reads ${stickerName}. This box will be ${boxName}, and a scan will say so.`
}

export const STICKER_NEW_ASK = 'What is it on?'

export type StickerBranch = 'known' | 'new'

export const STICKER_BRANCH_WORDS: Record<StickerBranch, string> = {
  known: 'It is on a box I know',
  new: 'It is a new box',
}

/** The press under the match list: *Put this sticker on R76*; *Put this sticker on a box* while no row is picked. */
export function placePressLabel(boxLabel: string | null): string {
  return boxLabel ? `Put this sticker on ${boxLabel}` : 'Put this sticker on a box'
}

/** The press under the new box: *Save box R97*, or *Save the box* while there is no name. */
export function newBoxPressLabel(name: string | null): string {
  return name ? `Save box ${name}` : 'Save the box'
}

/** Under the new box's name, before the job's own words: *Goes on* JP1204 · Juniper Ridge. */
export const GOES_ON_WORDS = 'Goes on'

/** Said when the phone has no signal: a sticker is never kept in the outbox, since two phones may hold the same one. */
export const NO_SIGNAL_WORDS = 'No signal. A sticker goes on a box only with signal. Try again when the phone has a bar.'

/** The sheet's line while the site's other jobs are read. */
export const READING_SITE_WORDS = 'Reading the other boxes on this site…'

// ---------------------------------------------------------------------------
// The match list
// ---------------------------------------------------------------------------

/** One box the sticker may go on, as the list draws it. */
export type MatchBox = {
  container: Container
  jobId: string
  /** The job as a row names it; empty for the job the person is on. */
  jobLabel: string
  /** On the job the person is on. */
  here: boolean
  /** The place it stands in, empty when nobody said. */
  place: string
  /** The parts in it, for the search. */
  partNames: string[]
  /** The stickers already on it, lowest first. */
  stickerNumbers: number[]
  /** The same stickers with the name printed on each, when the reader has them (section 10, PR 9). */
  marks?: StickerMark[]
}

/**
 * The boxes of the site a sticker may go on: every live cage, box and pile of every job handed in, Unsorted and the
 * retired left out (a retired box takes no sticker; Bring back first, as the judge says).
 */
export function matchBoxes(input: { hereJobId: string | null; jobs: ReadonlyArray<OnSiteFindJob>; stickersByBox?: ReadonlyMap<string, ReadonlyArray<number>>; marksByBox?: ReadonlyMap<string, ReadonlyArray<StickerMark>> }): MatchBox[] {
  const out: MatchBox[] = []
  for (const job of input.jobs) {
    const here = job.jobId === input.hereJobId
    for (const c of job.containers) {
      if (c.retiredAt || c.kind === 'unsorted') continue
      const place = job.places.find((p) => p.id === c.locationId)?.name ?? ''
      const partNames = job.lines.filter((l) => l.containerId === c.id && l.onHand > 0).map((l) => l.partName)
      const marks = input.marksByBox?.get(c.id)
      out.push({ container: c, jobId: job.jobId, jobLabel: here ? '' : job.label, here, place, partNames, stickerNumbers: [...(input.stickersByBox?.get(c.id) ?? [])].sort((a, b) => a - b), ...(marks ? { marks: [...marks] } : {}) })
    }
  }
  return out
}

/** A job as the list reads it, from the store's rows. */
export function matchJobOf(input: { jobId: string; label: string; containers: ReadonlyArray<Container>; lines: ReadonlyArray<ContainerLine>; places: ReadonlyArray<Place> }): OnSiteFindJob {
  return { jobId: input.jobId, label: input.label, containers: input.containers, lines: input.lines, places: input.places }
}

const fold = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * The list in order, searched. With nothing typed: the boxes with no sticker first (the ones the walk is for), this
 * job's own before the site's other jobs, then by stencil as read (`G9` before `G12`). Typed words match the start of
 * the stencil with its spaces dropped, or the start of its number (`76` finds `R76`, `r7` finds `R7` and `R76`), or
 * any part of the place, the where line, a part's name or the job's label.
 */
export function matchList(boxes: ReadonlyArray<MatchBox>, query: string): MatchBox[] {
  const q = fold(query)
  const stencil = q.replace(/\s+/g, '')
  const hits = q
    ? boxes.filter((b) => {
        const label = fold(b.container.label).replace(/\s+/g, '')
        if (label.startsWith(stencil)) return true
        if (/^\d/.test(stencil) && label.replace(/^[a-z]+/, '').startsWith(stencil)) return true
        const hay = [b.place, b.container.where, b.container.said ?? '', b.jobLabel, ...b.partNames].map(fold)
        return hay.some((h) => h.includes(q))
      })
    : [...boxes]
  return hits.sort((a, b) => {
    const aBlank = a.stickerNumbers.length === 0 ? 0 : 1
    const bBlank = b.stickerNumbers.length === 0 ? 0 : 1
    if (aBlank !== bBlank) return aBlank - bBlank
    if (a.here !== b.here) return a.here ? -1 : 1
    if (!a.here && a.jobLabel !== b.jobLabel) return a.jobLabel.localeCompare(b.jobLabel)
    return compareLabels(a.container.label, b.container.label)
  })
}

/** Which branch the sheet opens on: the known boxes while the site has boxes with no sticker, a new box once it has none. */
export function defaultBranch(boxes: ReadonlyArray<MatchBox>): StickerBranch {
  return boxes.some((b) => b.stickerNumbers.length === 0) ? 'known' : 'new'
}

/** Under the list: *49 boxes on this site have no sticker yet.* Empty when every box has one, or there is none. */
export function noStickerCountWords(boxes: ReadonlyArray<MatchBox>): string {
  const n = boxes.filter((b) => b.stickerNumbers.length === 0).length
  if (n === 0) return ''
  return n === 1 ? '1 box on this site has no sticker yet.' : `${n} boxes on this site have no sticker yet.`
}

/** The row's mark for a box with no sticker. */
export const NO_STICKER_MARK = 'no sticker'

// ---------------------------------------------------------------------------
// The number on a box
// ---------------------------------------------------------------------------

/** A sticker on a box, as a row needs it: the name printed on it, if any. Its number only keeps a box's stickers in order. */
export type StickerMark = { number: number; boxName?: string | null }

/**
 * What a box's row says of its stickers beside its name (section 10, PR 9; v2.7438). A sticker whose printed name
 * is the box's own says nothing, since the name is already there, and so does a sticker with no name. A sticker whose
 * name differs says so, *sticker reads G78*. Empty when nothing carries news.
 */
export function stickerMarksWords(label: string, marks: ReadonlyArray<StickerMark>): string {
  const out: string[] = []
  for (const m of [...marks].sort((a, b) => a.number - b.number)) {
    if (m.boxName && !stickerNameIs(m.boxName, label)) out.push(`sticker reads ${m.boxName.trim().toUpperCase()}`)
  }
  return out.join(', ')
}

/** The stickers on each box with their printed names, from the rows read: a lost sticker is not on its box any more. */
export function stickerMarksByBoxOf(rows: ReadonlyArray<StickerCountRow & { boxName?: string | null }>): Map<string, StickerMark[]> {
  const out = new Map<string, StickerMark[]>()
  for (const r of rows) {
    if (!r.containerId || r.lostAt) continue
    const list = out.get(r.containerId) ?? []
    list.push({ number: r.number, boxName: r.boxName ?? null })
    out.set(r.containerId, list)
  }
  for (const list of out.values()) list.sort((a, b) => a.number - b.number)
  return out
}

/** Said when a scan opens a box whose name is not the one on the sticker's tape: *This sticker reads G78. The box is G78B.* Empty when they agree or the sticker has no name. */
export function stickerReadsOtherWords(sticker: Pick<StickerFacts, 'boxName'>, boxLabel: string): string {
  if (!sticker.boxName || stickerNameIs(sticker.boxName, boxLabel)) return ''
  return `This sticker reads ${sticker.boxName}. The box is ${boxLabel}.`
}

/** A match row's words for the stickers on its box: what their marks say, or nothing when the reader has none. */
export function matchStickerWords(box: Pick<MatchBox, 'container' | 'marks'>): string {
  return box.marks ? stickerMarksWords(box.container.label, box.marks) : ''
}

/** The stickers on each box from the rows read: a lost sticker is not on its box any more. */
export function stickersByBoxOf(rows: ReadonlyArray<StickerCountRow>): Map<string, number[]> {
  const out = new Map<string, number[]>()
  for (const r of rows) {
    if (!r.containerId || r.lostAt) continue
    const list = out.get(r.containerId) ?? []
    list.push(r.number)
    out.set(r.containerId, list)
  }
  for (const list of out.values()) list.sort((a, b) => a - b)
  return out
}

// ---------------------------------------------------------------------------
// Stickers not yet on a box
// ---------------------------------------------------------------------------

/** How many of the job's stickers are still blank, across its runs. */
export function blankCountOf(runs: ReadonlyArray<{ stickers: ReadonlyArray<StickerCountRow> }>): number {
  let n = 0
  for (const run of runs) for (const s of run.stickers) if (!s.containerId && !s.lostAt) n += 1
  return n
}

/**
 * The job's reserved stickers as its screens say them (v2.7487): which, who reserved them and when, and since v2.7567 what printed of them, so a reserved
 * place is seen on the job and not only inside the Runs fold. One run holding them all is named, *G92 to G200*, with
 * its printer and day; more than one run is said by how many runs, and the fold has the rest.
 */
export type ReservedOfJob = {
  /** The job's stickers on no box and not lost, across its runs. */
  count: number
  /** The runs that hold them. */
  runs: number
  /** *G92 to G200*: the names, when one run holds them all and every one has a name. Empty otherwise. */
  span: string
  /** Those names in number order, for These are on boxes to open on. Empty when `span` is. */
  names: string[]
  /** Whether any reserved sticker has a name: These are on boxes can place it with no scan. */
  anyNamed: boolean
  /** Who reserved the one run, and when. Empty with more than one run. */
  printedByName: string
  printedAt: string
  /** The same stickers by the printed mark (punch list #373): seen to print, not printed yet, and those of a run the app was not watching. */
  mark: ReservedMark
}

export const NO_RESERVED: ReservedOfJob = { count: 0, runs: 0, span: '', names: [], anyNamed: false, printedByName: '', printedAt: '', mark: NO_MARK }

type ReservedRun = { run: { names?: ReadonlyArray<string> | null; printedByName?: string; printedAt?: string }; stickers: ReadonlyArray<StickerCountRow & { boxName?: string | null; printedAt?: string | null }> }

export function reservedOfJob(runs: ReadonlyArray<ReservedRun>): ReservedOfJob {
  const holding = runs
    .map((r) => ({ run: r.run, left: r.stickers.filter((s) => !s.containerId && !s.lostAt).sort((a, b) => a.number - b.number) }))
    .filter((r) => r.left.length > 0)
  const count = holding.reduce((n, r) => n + r.left.length, 0)
  if (count === 0) return NO_RESERVED
  const anyNamed = holding.some((r) => r.left.some((s) => s.boxName))
  const mark = reservedMarkOf(runs)
  if (holding.length > 1) return { ...NO_RESERVED, count, runs: holding.length, anyNamed, mark }
  const one = holding[0]!
  const names = one.left.every((s) => s.boxName) ? one.left.map((s) => s.boxName as string) : []
  const span = names.length > 0 ? namesSpanWords(names, one.run.names ?? names) : ''
  return { count, runs: 1, span, names, anyNamed, printedByName: (one.run.printedByName ?? '').trim(), printedAt: one.run.printedAt ?? '', mark }
}

/**
 * *12 stickers reserved and not on a box yet*, with which when one run holds them, *, G92 to G200*, or in how many
 * runs, *, in 2 runs*. Empty at none. *Not yet on a box* alone until v2.7487: the stickers are reserved, and say so.
 */
export function notYetOnBoxWords(n: number, of?: Pick<ReservedOfJob, 'span' | 'runs'>): string {
  if (n <= 0) return ''
  const head = n === 1 ? '1 sticker reserved and not on a box yet' : `${n} stickers reserved and not on a box yet`
  if (of?.span) return `${head}, ${of.span}`
  return of && of.runs > 1 ? `${head}, in ${of.runs} runs` : head
}

/**
 * *Reserved Nov 16 by Dana.*: who reserved the job's one run of them and when, after the count. Empty with more than
 * one run or no day. `day` is the day the run was made, as words. It read *Printed* until v2.7567: the day is the
 * reserving, and whether a strip came out is the mark's to say (`reservedMarkWords`).
 */
export function reservedByWords(of: Pick<ReservedOfJob, 'runs' | 'printedByName'>, day: string): string {
  if (of.runs !== 1 || !day) return ''
  return of.printedByName ? `Reserved ${day} by ${of.printedByName}.` : `Reserved ${day}.`
}

/** After the count of a job's reserved stickers (punch list #373): *None printed yet.*, *40 printed, 18 not printed yet.* or *All printed.* Empty where the app was not watching. */
export function reservedMarkWords(of: Pick<ReservedOfJob, 'mark'>): string {
  return markCountsWords(of.mark)
}

/**
 * A job's reserved stickers in one sentence run, as its line and its card say them: the count, what printed, then who
 * reserved them and when. *58 stickers reserved and not on a box yet, G93 to G150. 40 printed, 18 not printed yet.
 * Reserved Nov 17 by Dana.* Empty at none.
 */
export function reservedLineWords(of: ReservedOfJob, day: string): string {
  const head = notYetOnBoxWords(of.count, of)
  if (!head) return ''
  return [`${head}.`, reservedMarkWords(of), reservedByWords(of, day)].filter(Boolean).join(' ')
}

/**
 * The phone's one line for a job's reserved stickers (v2.8282), the press that opens the whole of it: *58 stickers
 * reserved, G93 to G150*, or *40 stickers reserved, in 2 runs*. Empty at none.
 */
export function reservedShortWords(of: Pick<ReservedOfJob, 'count' | 'span' | 'runs'>): string {
  if (of.count <= 0) return ''
  const head = of.count === 1 ? '1 sticker reserved' : `${of.count} stickers reserved`
  if (of.span) return `${head}, ${of.span}`
  return of.runs > 1 ? `${head}, in ${of.runs} runs` : head
}

/** The Print future stickers window's line, before a new run: *This job has 12 stickers reserved and not on a box yet. None printed yet.* Empty at none. */
export function jobBlankWords(n: number, mark: ReservedMark = NO_MARK): string {
  const head = notYetOnBoxWords(n)
  if (!head) return ''
  return [`This job has ${head}.`, markCountsWords(mark)].filter(Boolean).join(' ')
}

/** The phone's line under the boxes, with what to do about it. */
export function notYetOnBoxLine(n: number, of?: Pick<ReservedOfJob, 'span' | 'runs'>): string {
  const head = notYetOnBoxWords(n, of)
  return head ? `${head}. Scan one to say which box it is on.` : ''
}

// ---------------------------------------------------------------------------
// The placing: the request and the answer
// ---------------------------------------------------------------------------

/** What the sheet asks the database for. */
export type PlaceRequest =
  | { kind: 'known'; stickerId: string; containerId: string }
  | { kind: 'new'; stickerId: string; containerId: string; jobId: string; label: string; boxKind: 'cage' | 'box' | 'loose'; where: string; placeId: string | null }

/** `place_sticker`'s arguments for a request. The client cuts the new box's id, so a second send of the same press is the same box. */
export function placeStickerArgs(r: PlaceRequest): Record<string, unknown> {
  if (r.kind === 'known') return { p_sticker_id: r.stickerId, p_container_id: r.containerId }
  return { p_sticker_id: r.stickerId, p_container_id: r.containerId, p_job_id: r.jobId, p_label: r.label, p_kind: r.boxKind, p_where_note: r.where, p_place_id: r.placeId }
}

/** `place_sticker`'s answer, read back. */
export type PlaceAnswer =
  | { ok: true; already: boolean; created: boolean; containerId: string | null; sticker: StickerFacts | null }
  | { ok: false; sticker: StickerFacts | null }

export function placeAnswerOf(raw: unknown): PlaceAnswer | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.ok !== 'boolean') return null
  const sticker = stickerFactsOf(r.sticker)
  if (!r.ok) return { ok: false, sticker }
  return { ok: true, already: r.already === true, created: r.created === true, containerId: typeof r.container_id === 'string' ? r.container_id : null, sticker }
}

/** Said when the answer is not one the sheet can read. */
export const PLACE_UNREAD_WORDS = 'The sticker did not read back. Scan it again to see where it is.'

/**
 * What became of the press, in words:
 *  - `placed`: *The sticker is on R76.*
 *  - `created`: *R97 is made, with its sticker on it.*
 *  - `already`: *The sticker was already on R76.* (the same press sent twice)
 *  - `taken`: someone else took it first: *Marcus put this sticker on R76 a minute ago.*, with the box to open
 *  - `out_of_reach`: it is on a box of a job the person is not on
 *  - `lost`: it was marked lost
 */
export type PlaceOutcome = {
  kind: 'placed' | 'created' | 'already' | 'taken' | 'out_of_reach' | 'lost'
  words: string
  /** The box to open, when there is one the person may reach. */
  containerId: string | null
  jobId: string | null
}

export function placeOutcome(answer: PlaceAnswer, input: { /** The jobs the person may open. */ jobIds: ReadonlyArray<string>; /** The box the press named, for the words when the answer carries none. */ boxLabel: string; /** The name printed on the sticker, when the answer carries no sticker to read it from. */ boxName?: string | null; now: string }): PlaceOutcome {
  if (answer.ok) {
    const label = answer.sticker?.containerLabel ?? input.boxLabel
    const containerId = answer.containerId ?? answer.sticker?.containerId ?? null
    const jobId = answer.sticker?.jobId ?? null
    // A sticker named for another box than the one it is on says both names. Any other is *the sticker*: on the box
    // of its own name the name says it all, and a sticker with no name has nothing else to be called.
    const name = (answer.sticker?.boxName ?? input.boxName ?? '').trim().toUpperCase()
    const other = name && !stickerNameIs(name, label) ? name : ''
    if (answer.already) return { kind: 'already', words: other ? `Sticker ${other} was already on ${label}.` : `The sticker was already on ${label}.`, containerId, jobId }
    if (answer.created) return { kind: 'created', words: other ? `${label} is made, with sticker ${other} on it.` : `${label} is made, with its sticker on it.`, containerId, jobId }
    return { kind: 'placed', words: other ? `Sticker ${other} is on ${label}.` : `The sticker is on ${label}.`, containerId, jobId }
  }
  const s = answer.sticker
  if (!s) return { kind: 'taken', words: PLACE_UNREAD_WORDS, containerId: null, jobId: null }
  const verdict = placingVerdict({ sticker: s, now: input.now })
  if (verdict.kind === 'lost') return { kind: 'lost', words: verdict.words, containerId: null, jobId: s.jobId }
  if (verdict.kind === 'on_box') {
    const reach = s.jobId != null && input.jobIds.includes(s.jobId)
    if (!reach) return { kind: 'out_of_reach', words: 'This sticker is on a box of a job you are not on. Ask the office to add you to that job.', containerId: null, jobId: s.jobId }
    return { kind: 'taken', words: verdict.words, containerId: s.containerId, jobId: s.jobId }
  }
  // Blank still: the database refused nothing and placed nothing, which it never answers; said plainly.
  return { kind: 'taken', words: PLACE_UNREAD_WORDS, containerId: null, jobId: null }
}

/** The press on a taken sticker's words: *Open R76*. */
export function openBoxLabel(boxLabel: string | null): string {
  return boxLabel ? `Open ${boxLabel}` : 'Open the box'
}

// ---------------------------------------------------------------------------
// What a typed scan means
// ---------------------------------------------------------------------------

/** What Scan a label was handed: a label's or a sticker's eight characters, nothing, or something short. */
export type ScanTyped = { kind: 'code'; code: string } | { kind: 'empty' } | { kind: 'short' }

/** Eight letters and digits are a code, with or without its dash. Anything shorter is not one yet. */
export function readScanTyped(raw: string): ScanTyped {
  const clean = raw.replace(/[^0-9a-z]/gi, '').toUpperCase()
  if (!clean) return { kind: 'empty' }
  if (/^[0-9A-Z]{8}$/.test(clean)) return { kind: 'code', code: clean }
  return { kind: 'short' }
}

/** The field as it is typed: capitals and digits, with the code's dash after four. */
export function scanTypedWords(raw: string): string {
  const c = raw.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8)
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

export const SCAN_TYPED_SLIP = 'Type all eight characters under the QR code.'
