/**
 * Print labels' *Which job?* window (punch list #304; the owner's ask of 2026-11-16, v2.7482): what each job's card
 * says before a job is picked. The window used to be a list of names with a count; a card now says what the labels
 * are (cages and boxes apart, the names from first to last, each place with its count), what waits (since v2.7519 the
 * boxes whose label the app has not seen print, `labelMark.ts`, where it said the boxes added in the last seven days;
 * boxes that already wear a sticker, empty boxes), a run this computer left half done today, the tape or the pages
 * the job takes, and the doors into the labels window. Pure: the jobs and the device's memory in, the words out. The window is `PrintLabelsWindow.tsx`.
 */
import { boxKindWords } from './editBox'
import { ALL_LABELLED_WORDS, everyBoxLabelled, notPrintedChipWords, notPrintedDoorLabel, notPrintedIds } from './labelMark'
import { stoppedRunToResume, type StoppedRun } from './labelPick'
import { labelPrintName, labelPrintNames } from './labels'
import { compareLabels, type Container, type ContainerKind, type ContainerLine } from './onSite'
import { labelBoxes, type OnSiteFindJob } from './onSiteFind'
import { clampTapeCopies, tapeLayout, type LabelFormat, type TapeWidthMm } from './tapeLabel'

/** A job with this many boxes or fewer names each one; past it the card says the first and the last. */
export const LABEL_NAMES_LISTED = 6
/** The search shows past this many jobs. */
export const LABEL_JOBS_SEARCH_PAST = 6
/** What a full TZe cassette holds, in millimetres: 8 m. */
export const TAPE_CASSETTE_MM = 8000
/** The place line of the boxes nobody gave a place. */
export const NO_PLACE_WORDS = 'No place said yet'

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The kinds in the order a card reads them. */
const KIND_ORDER: ReadonlyArray<ContainerKind> = ['box', 'cage', 'loose']

/** *88 boxes · 3 cages · 1 loose pile*, a kind with none left out. */
export function kindCountsWords(boxes: ReadonlyArray<Pick<Container, 'kind'>>): string {
  return KIND_ORDER.map((kind) => {
    const n = boxes.filter((b) => b.kind === kind).length
    if (n === 0) return ''
    const word = boxKindWords(kind).toLowerCase()
    return count(n, word, kind === 'box' ? 'boxes' : `${word}s`)
  }).filter(Boolean).join(' · ')
}

/** The names as a card reads them: each one up to `LABEL_NAMES_LISTED`, else the first and the last. */
export function nameSpan(names: ReadonlyArray<string>): { listed: string[] } | { first: string; last: string } | null {
  const sorted = [...names].sort(compareLabels)
  if (sorted.length === 0) return null
  if (sorted.length <= LABEL_NAMES_LISTED) return { listed: sorted }
  return { first: sorted[0]!, last: sorted[sorted.length - 1]! }
}

/** Each place with how many of the boxes stand in it, by name, the boxes with no place last. */
export function placeCounts(boxes: ReadonlyArray<Pick<Container, 'locationId'>>, places: ReadonlyArray<{ id: string; name: string }>): Array<{ name: string; n: number }> {
  const byName = new Map<string, number>()
  let none = 0
  for (const b of boxes) {
    const name = b.locationId ? places.find((p) => p.id === b.locationId)?.name.trim() : ''
    if (name) byName.set(name, (byName.get(name) ?? 0) + 1)
    else none += 1
  }
  const named = [...byName.entries()].map(([name, n]) => ({ name, n })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  return none > 0 ? [...named, { name: NO_PLACE_WORDS, n: none }] : named
}

/** How many of the boxes hold nothing: no line with a part on hand. */
export function emptyBoxCount(boxes: ReadonlyArray<Pick<Container, 'id'>>, lines: ReadonlyArray<Pick<ContainerLine, 'containerId' | 'onHand'>>): number {
  const holding = new Set(lines.filter((l) => l.onHand > 0).map((l) => l.containerId))
  return boxes.filter((b) => !holding.has(b.id)).length
}

/** A length of tape as a person says it: *9 cm* under a metre, *3.8 m* past it. */
export function tapeLengthWords(mm: number): string {
  return mm < 1000 ? `${Math.max(1, Math.round(mm / 10))} cm` : `${(mm / 1000).toFixed(1)} m`
}

/** The length against a full cassette, said only once it is a real share of one: *about half a cassette*. */
export function cassetteShareWords(mm: number): string {
  const share = mm / TAPE_CASSETTE_MM
  if (share < 0.2) return ''
  if (share < 0.3) return 'about a quarter of a cassette'
  if (share < 0.42) return 'about a third of a cassette'
  if (share < 0.6) return 'about half a cassette'
  if (share < 0.72) return 'about two thirds of a cassette'
  if (share < 0.9) return 'about three quarters of a cassette'
  if (share < 1.1) return 'about a whole cassette'
  return `about ${share.toFixed(1)} cassettes`
}

/**
 * What the job takes to print: on paper its pages, on tape its strips, their length and the share of a cassette. The
 * length is each strip at the print window's size for its own name (`tapeLayout`), so straight to the P-touch, where
 * a strip is trimmed to its ink, a run comes in a little under it. `copies` is strips of each box, tape only.
 */
export function printNeedWords(format: LabelFormat, names: ReadonlyArray<string>, widthMm: TapeWidthMm, copies: number): string {
  if (format === 'sheet') return count(names.length, 'page', 'pages')
  const each = clampTapeCopies(copies)
  const strips = names.length * each
  const mm = names.reduce((sum, name) => sum + tapeLayout(widthMm, name.length).lengthMm, 0) * each
  const head = `${count(strips, 'strip', 'strips')}${each > 1 ? `, ${each} of each` : ''}`
  const share = cassetteShareWords(mm)
  return `${head} · about ${tapeLengthWords(mm)} of ${widthMm} mm tape${share ? ` · ${share}` : ''}`
}

/** A run this computer stopped part way today: the boxes still to print and the name the run picks up at. */
export type LabelJobResume = { boxes: number; from: string }

/** *A run stopped here today. 51 boxes are left, from G41.* */
export function resumeWords(r: LabelJobResume): string {
  return r.boxes === 1 ? `A run stopped here today. 1 box is left, ${r.from}.` : `A run stopped here today. ${r.boxes} boxes are left, from ${r.from}.`
}

/** A way into the labels window from a card: the rest of a stopped run, the boxes not printed yet, or every box. */
export type LabelJobDoor = { kind: 'rest' | 'unprinted' | 'all'; label: string; ids: string[] }

export type LabelJobFacts = {
  jobId: string
  /** The job as one line, for a row that could not be split and for the search. */
  label: string
  number: string
  name: string
  /** The site and the street, either left out when unknown; empty when neither is known. */
  where: string
  /** The boxes a label prints for. */
  labels: number
  kinds: string
  names: ReturnType<typeof nameSpan>
  places: Array<{ name: string; n: number }>
  /**
   * The boxes that wait for a label: made since the mark began, no label seen and no sticker on them. Null while the
   * stickers are unread, since a box with a sticker waits for nothing.
   */
  notPrintedIds: string[] | null
  /** Every box is known to carry a code, by a label seen to print or a sticker. False while the stickers are unread. */
  allLabelled: boolean
  /** Boxes that already wear a sticker; null while unread, and the chip is left out. */
  stickered: number | null
  empty: number
  resume: LabelJobResume | null
  need: string
  doors: LabelJobDoor[]
  /** The first box by name, for the band's sample; null for a job with none. */
  sample: { id: string; name: string } | null
}

/** *All 91*, *Both labels*, *The one label*: the door onto every box. */
export function allDoorLabel(n: number): string {
  return n === 1 ? 'The one label' : n === 2 ? 'Both labels' : `All ${n}`
}

export type LabelJobsInput = {
  /** Today in the app's time zone, as the stopped run is kept. */
  today: string
  kept: StoppedRun | null
  format: LabelFormat
  widthMm: TapeWidthMm
  copies: number
  /** The ids of the boxes that wear a sticker, null while unread. */
  stickeredIds: ReadonlySet<string> | null
  /** A job's site by its id. */
  siteOf?: (jobId: string) => string | null | undefined
}

/** One job's card. Null for a job with no box to label. */
export function labelJobFacts(job: OnSiteFindJob, input: LabelJobsInput): LabelJobFacts | null {
  const boxes = labelBoxes(job).sort((a, b) => compareLabels(a.label, b.label))
  if (boxes.length === 0) return null
  const printNames = labelPrintNames(job.containers)
  const nameOf = (b: Container) => labelPrintName(printNames, b)
  const ids = boxes.map((b) => b.id)
  const waiting = input.stickeredIds ? notPrintedIds(boxes, input.stickeredIds) : null
  const kept = stoppedRunToResume(input.kept, job.jobId, input.today, ids)
  const restIds = kept ? ids.filter((id) => !kept.left.has(id)) : []
  const first = restIds.length > 0 ? boxes.find((b) => b.id === restIds[0]) : undefined
  const resume = kept && first ? { boxes: restIds.length, from: nameOf(first) } : null
  const doors: LabelJobDoor[] = []
  if (resume) doors.push({ kind: 'rest', label: `The rest, ${count(resume.boxes, 'box', 'boxes')}`, ids: restIds })
  // Every box waiting is the same pick as every box, so it is one door.
  if (waiting && waiting.length > 0 && waiting.length < boxes.length) doors.push({ kind: 'unprinted', label: notPrintedDoorLabel(waiting.length), ids: waiting })
  doors.push({ kind: 'all', label: allDoorLabel(boxes.length), ids })
  const site = input.siteOf?.(job.jobId)?.trim() ?? ''
  const street = job.address?.trim() ?? ''
  return {
    jobId: job.jobId,
    label: job.label,
    number: job.number?.trim() ?? '',
    name: job.name?.trim() || (job.number ? '' : job.label),
    where: [site, street].filter(Boolean).join(' · '),
    labels: boxes.length,
    kinds: kindCountsWords(boxes),
    names: nameSpan(boxes.map(nameOf)),
    places: placeCounts(boxes, job.places),
    notPrintedIds: waiting,
    allLabelled: input.stickeredIds ? everyBoxLabelled(boxes, input.stickeredIds) : false,
    stickered: input.stickeredIds ? boxes.filter((b) => input.stickeredIds!.has(b.id)).length : null,
    empty: emptyBoxCount(boxes, job.lines),
    resume,
    need: printNeedWords(input.format, boxes.map(nameOf), input.widthMm, kept?.copies ?? input.copies),
    doors,
    sample: boxes[0] ? { id: boxes[0].id, name: nameOf(boxes[0]) } : null,
  }
}

/** Every job with a box, in order of need: a run to finish, then boxes not printed yet, then the job's number and name. */
export function labelJobsInOrder(jobs: ReadonlyArray<OnSiteFindJob>, input: LabelJobsInput): LabelJobFacts[] {
  const rank = (f: LabelJobFacts) => (f.resume ? 0 : f.notPrintedIds && f.notPrintedIds.length > 0 ? 1 : 2)
  return jobs
    .map((j) => labelJobFacts(j, input))
    .filter((f): f is LabelJobFacts => f != null)
    .sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label, undefined, { numeric: true }))
}

/** The cards a typed search leaves: every typed word in the job's number, name, site or street. */
export function findLabelJobs(facts: ReadonlyArray<LabelJobFacts>, query: string): LabelJobFacts[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return [...facts]
  return facts.filter((f) => { const hay = `${f.label} ${f.where}`.toLowerCase(); return words.every((w) => hay.includes(w)) })
}

/** *3 jobs hold a cage or a box.* */
export function labelJobsCountWords(n: number): string {
  return n === 1 ? '1 job holds a cage or a box.' : `${n} jobs hold a cage or a box.`
}

export type LabelJobChip = { tone: 'green' | 'amber' | 'blue' | 'gray'; words: string }

/** The chips of a card, in order: what waits for a label or that nothing does, what wears a sticker, what is empty. */
export function labelJobChips(f: Pick<LabelJobFacts, 'notPrintedIds' | 'allLabelled' | 'stickered' | 'empty'>): LabelJobChip[] {
  const chips: LabelJobChip[] = []
  if (f.notPrintedIds && f.notPrintedIds.length > 0) chips.push({ tone: 'amber', words: notPrintedChipWords(f.notPrintedIds.length) })
  else if (f.allLabelled) chips.push({ tone: 'green', words: ALL_LABELLED_WORDS })
  if (f.stickered != null && f.stickered > 0) chips.push({ tone: 'blue', words: f.stickered === 1 ? '1 already wears a sticker' : `${f.stickered} already wear a sticker` })
  if (f.empty > 0) chips.push({ tone: 'gray', words: `${f.empty} empty` })
  return chips
}

/** The window's first line under its title. */
export const PRINT_LABELS_WHAT = 'A label is for a cage or a box that is already in the app. Pick the job, then the boxes.'
/** The foot's question, before the press that prints stickers for boxes not made yet. */
export const PRINT_LABELS_NOT_YET = 'Boxes that are not in the app yet?'
