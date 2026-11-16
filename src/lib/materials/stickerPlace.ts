/**
 * Stickers before boxes (punch list #329, PR 3, v2.7298): the first scan. A signed-in scan of a blank sticker opens
 * the On site tab on one sheet, **Sticker 0147 is new**, with two branches: **It is on a box I know**, a match list of
 * the development's live boxes (this job's first, the boxes with no sticker first, searched by stencil, place, where
 * line and parts), each row a press that puts the sticker on that box through `place_sticker`; and **It is a new
 * box**, the box made in the same `place_sticker` call, named by the site's next free name (`boxName.ts`, the owner's
 * change to call 7 on 2026-11-14: never the sticker's number) with the number shown beside it.
 *
 * Pure: the sheet's words, the match list's order and search, the answer read back and said, the number beside a
 * box's name, the count of stickers not yet on a box, and what a typed scan means (a code or a number). The reads
 * and the one write are `stickerPlaceIo.ts`; the sheet is `StickerNewSheet.tsx`.
 */
import { nameTakenBy, type SiteBox } from './boxName'
import { compareLabels, type Container, type ContainerLine, type Place } from './onSite'
import type { OnSiteFindJob } from './onSiteFind'
import { nextTwinName } from './stickerNames'
import { placingVerdict, stickerFactsOf, stickerNameIs, stickerNumberWords, stickerSayName, type StickerCountRow, type StickerFacts } from './stickers'

// ---------------------------------------------------------------------------
// The sheet's words
// ---------------------------------------------------------------------------

/** The sheet's heading: *Sticker 0147 is new*; a named sticker by the name on its tape, *Sticker G78 is new* (section 10, PR 9). */
export function stickerNewTitle(sticker: number | Pick<StickerFacts, 'number' | 'boxName'>): string {
  return `Sticker ${typeof sticker === 'number' ? stickerNumberWords(sticker) : stickerSayName(sticker)} is new`
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

/** The press under the match list: *Put 0147 on R76*. */
export function placePressLabel(number: number, boxLabel: string): string {
  return `Put ${stickerNumberWords(number)} on ${boxLabel}`
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

/** A sticker on a box, as a row needs it: its number and the name printed on it, if any. */
export type StickerMark = { number: number; boxName?: string | null }

/**
 * What a box's row says of its stickers beside its name (section 10, PR 9: the number recedes). A sticker whose
 * printed name is the box's own says nothing, since the name is already there. A sticker whose name differs says so,
 * *sticker reads G78*. A sticker with a number only reads its number, as before. Empty when nothing carries news.
 */
export function stickerMarksWords(label: string, marks: ReadonlyArray<StickerMark>): string {
  const out: string[] = []
  for (const m of [...marks].sort((a, b) => a.number - b.number)) {
    if (!m.boxName) out.push(stickerNumberWords(m.number))
    else if (!stickerNameIs(m.boxName, label)) out.push(`sticker reads ${m.boxName.trim().toUpperCase()}`)
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

/** A match row's words for the stickers on its box: by their marks when the reader has them, by number when not. */
export function matchStickerWords(box: Pick<MatchBox, 'container' | 'stickerNumbers' | 'marks'>): string {
  return box.marks ? stickerMarksWords(box.container.label, box.marks) : stickerNumbersWords(box.stickerNumbers)
}

/** The stickers on a box, as the row reads them: `0147`, or `0147, 0152`. Empty with none. */
export function stickerNumbersWords(numbers: ReadonlyArray<number>): string {
  return [...numbers].sort((a, b) => a - b).map(stickerNumberWords).join(', ')
}

/** A box's name with its stickers beside it: *G12 · 0147*. The name alone with none. */
export function boxWithStickersWords(label: string, numbers: ReadonlyArray<number>): string {
  const n = stickerNumbersWords(numbers)
  return n ? `${label} · ${n}` : label
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

/** *12 stickers not yet on a box*. Empty at none. */
export function notYetOnBoxWords(n: number): string {
  if (n <= 0) return ''
  return n === 1 ? '1 sticker not yet on a box' : `${n} stickers not yet on a box`
}

/** The Print blank stickers window's line, before a new run: *This job has 12 stickers not yet on a box.* Empty at none. */
export function jobBlankWords(n: number): string {
  const head = notYetOnBoxWords(n)
  return head ? `This job has ${head}.` : ''
}

/** The phone's line under the boxes, with what to do about it. */
export function notYetOnBoxLine(n: number): string {
  const head = notYetOnBoxWords(n)
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
 *  - `placed`: *0147 is on R76.*
 *  - `created`: *R97 is made, with sticker 0147 on it.*
 *  - `already`: *0147 was already on R76.* (the same press sent twice)
 *  - `taken`: someone else took it first: *Marcus put 0147 on R76 a minute ago.*, with the box to open
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

export function placeOutcome(answer: PlaceAnswer, input: { /** The jobs the person may open. */ jobIds: ReadonlyArray<string>; /** The box the press named, for the words when the answer carries none. */ boxLabel: string; number: number; /** The name printed on the sticker, when the answer carries no sticker to read it from. */ boxName?: string | null; now: string }): PlaceOutcome {
  const n = stickerNumberWords(input.number)
  if (answer.ok) {
    const label = answer.sticker?.containerLabel ?? input.boxLabel
    const containerId = answer.containerId ?? answer.sticker?.containerId ?? null
    const jobId = answer.sticker?.jobId ?? null
    // A named sticker (section 10): on the box of its own name the name says it all; on another, the two are said.
    const name = (answer.sticker?.boxName ?? input.boxName ?? '').trim().toUpperCase()
    if (name) {
      const same = stickerNameIs(name, label)
      if (answer.already) return { kind: 'already', words: same ? `The sticker was already on ${label}.` : `Sticker ${name} was already on ${label}.`, containerId, jobId }
      if (answer.created) return { kind: 'created', words: same ? `${label} is made, with its sticker on it.` : `${label} is made, with sticker ${name} on it.`, containerId, jobId }
      return { kind: 'placed', words: same ? `The sticker is on ${label}.` : `Sticker ${name} is on ${label}.`, containerId, jobId }
    }
    if (answer.already) return { kind: 'already', words: `${n} was already on ${label}.`, containerId, jobId }
    if (answer.created) return { kind: 'created', words: `${label} is made, with sticker ${n} on it.`, containerId, jobId }
    return { kind: 'placed', words: `${n} is on ${label}.`, containerId, jobId }
  }
  const s = answer.sticker
  if (!s) return { kind: 'taken', words: PLACE_UNREAD_WORDS, containerId: null, jobId: null }
  const verdict = placingVerdict({ sticker: s, now: input.now })
  if (verdict.kind === 'lost') return { kind: 'lost', words: verdict.words, containerId: null, jobId: s.jobId }
  if (verdict.kind === 'on_box') {
    const reach = s.jobId != null && input.jobIds.includes(s.jobId)
    if (!reach) return { kind: 'out_of_reach', words: `${s.boxName ? 'This sticker' : n} is on a box of a job you are not on. Ask the office to add you to that job.`, containerId: null, jobId: s.jobId }
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

/** What Scan a label was handed: a label's eight characters, a sticker's number, nothing, or something short. */
export type ScanTyped = { kind: 'code'; code: string } | { kind: 'number'; number: number } | { kind: 'empty' } | { kind: 'short' }

/** Digits alone up to five are a sticker's number (`0147`, `10432`); eight letters and digits are a code. */
export function readScanTyped(raw: string): ScanTyped {
  const clean = raw.replace(/[^0-9a-z]/gi, '').toUpperCase()
  if (!clean) return { kind: 'empty' }
  if (/^\d{1,5}$/.test(clean)) {
    const number = Number(clean)
    return number >= 1 ? { kind: 'number', number } : { kind: 'short' }
  }
  if (/^[0-9A-Z]{8}$/.test(clean)) return { kind: 'code', code: clean }
  return { kind: 'short' }
}

/** The field as it is typed: digits alone stay as typed (a number), anything else takes a code's dash after four. */
export function scanTypedWords(raw: string): string {
  const c = raw.replace(/[^0-9a-z]/gi, '').toUpperCase().slice(0, 8)
  if (/^\d{1,5}$/.test(c)) return c
  return c.length > 4 ? `${c.slice(0, 4)}-${c.slice(4)}` : c
}

/** The slip for a typed number no sticker answers for this person. */
export function noStickerByNumberWords(number: number): string {
  return `No sticker ${stickerNumberWords(number)} is on a job you are on.`
}

export const SCAN_TYPED_SLIP = 'Type all eight characters under the QR code, or the sticker’s number.'
