/**
 * These are on boxes (punch list #329, design section 10, PR 10): a range of named stickers put on their boxes in one
 * press, with no scan. A sticker printed with a name cannot shift anything, since the tape reads G78 and it goes on
 * the cage painted G78. So the person who stuck a roll types the range they used, *G78 to G150, cages, Arena*, and
 * the boxes are made with their stickers, the kind and the place. A name that is a box on the site already takes its
 * sticker instead, a name whose sticker is on a box already is left as it is and said, a name no sticker was printed
 * with makes nothing, and the rest go on. The scan then only adds what is inside.
 *
 * Pure: what the typed range means against the site (the plan, before the press), the press's words, the request,
 * the database's answer read back and said. The range is `stickerNames.ts`'s, the same parser the print window reads
 * by. The write is `place_sticker_range` (`stickersOnBoxesIo.ts`), a caller of `place_sticker` once a sticker, which
 * judges every name again; the plan here only keeps the press honest. The form is `StickersOnBoxes.tsx`.
 */
import { countedLabel, pluralNoun } from '../batchWords'
import type { SiteBox } from './boxName'
import { BOX_WHERE_MAX, type BoxKindChoice } from './editBox'
import { namesSpanWords, readStickerRange, type StickerRange } from './stickerNames'

/** The press that opens the form, on a run's row in the Runs fold and on the phone's On site tab, and the form's title. */
export const ON_BOXES_LABEL = 'These are on boxes'

/** Under the title: what the form does, in one line. */
export const ON_BOXES_SUB = 'Type the names of the stickers you stuck on. Each one gets its box, with no scan.'

export const ON_BOXES_NAMES_LABEL = 'Names'
export const ON_BOXES_PLACEHOLDER = 'G78-150'

/** Under the field while nothing is typed. */
export const ON_BOXES_EMPTY_WORDS = 'Type the first name and the last with a dash between, like G78-150. One name alone is one box.'

/** While the site's boxes and blank stickers are read: the press waits, so it never counts from nothing. */
export const ON_BOXES_READING_WORDS = 'Reading the site’s boxes and stickers…'

/** When that read failed: the press still sends the names, and the database says what became of each. */
export const ON_BOXES_UNREAD_WORDS = 'The site’s boxes and stickers did not load, so nothing is counted ahead. The press still works, and says what happened after.'

/** What the site holds, as far as the form read it: its boxes, and the names on its stickers that are on no box and not lost. */
export type OnBoxesSite = { boxes: ReadonlyArray<SiteBox>; blankNames: ReadonlyArray<string> }

/** What the press will do with a list of names, read off the site before it is pressed. */
export type OnBoxesPlan = {
  /** A blank sticker and no live box of the name: a box is made, with the sticker on it. */
  make: string[]
  /** A blank sticker and a live box of the name on the site: the sticker goes on that box. */
  take: string[]
  /** No blank sticker of the name: it is on a box already, or none was printed. Nothing is done. */
  none: string[]
}

/** The plan for a list of names against the site. Capitals and spaces around a name do not matter. */
export function onBoxesPlan(names: ReadonlyArray<string>, site: OnBoxesSite): OnBoxesPlan {
  const blank = new Set(site.blankNames.map((n) => n.trim().toUpperCase()))
  const live = new Set(site.boxes.filter((b) => !b.retiredAt && b.kind !== 'unsorted').map((b) => b.label.trim().toUpperCase()))
  const plan: OnBoxesPlan = { make: [], take: [], none: [] }
  for (const name of names) {
    if (!blank.has(name)) plan.none.push(name)
    else if (live.has(name)) plan.take.push(name)
    else plan.make.push(name)
  }
  return plan
}

/** The names the press acts on: every one with a blank sticker. */
export function onBoxesReady(plan: OnBoxesPlan): number {
  return plan.make.length + plan.take.length
}

/** The plan in sentences, each its own line under the field. `names` is the whole range, for the spans. */
export function onBoxesPlanLines(plan: OnBoxesPlan, names: ReadonlyArray<string>): string[] {
  const lines: string[] = []
  const make = plan.make.length
  const take = plan.take.length
  const none = plan.none.length
  if (make > 0) lines.push(make === 1 ? `1 box will be made, ${namesSpanWords(plan.make, names)}.` : `${make} boxes will be made, ${namesSpanWords(plan.make, names)}.`)
  if (take > 0) lines.push(take === 1 ? `1 is a box on this site already, ${namesSpanWords(plan.take, names)}. Its sticker goes on it.` : `${take} are boxes on this site already, ${namesSpanWords(plan.take, names)}. Their stickers go on them.`)
  if (none > 0) lines.push(none === 1 ? `1 has no blank sticker, ${namesSpanWords(plan.none, names)}. Nothing is done for it.` : `${none} have no blank sticker, ${namesSpanWords(plan.none, names)}. Nothing is done for them.`)
  return lines
}

/** The Names field read: the range, its names and the line under the field. A name typed alone is one name. */
export type OnBoxesAsk = {
  range: StickerRange
  /** The names of the range in order; null while nothing is typed or the range is refused. */
  names: string[] | null
  /** The line under the field: what was read, the refusal, or what to type. */
  words: string
  tone: 'ok' | 'refused' | 'empty'
}

export function onBoxesAsk(typed: string): OnBoxesAsk {
  const range = readStickerRange(typed, 1)
  if (range.kind === 'numbered') return { range, names: null, words: ON_BOXES_EMPTY_WORDS, tone: 'empty' }
  if (range.kind === 'refused') return { range, names: null, words: range.words, tone: 'refused' }
  const n = range.names.length
  return { range, names: range.names, words: n === 1 ? `${range.first} · 1 name.` : `${range.first} to ${range.last} · ${n} names.`, tone: 'ok' }
}

/**
 * The press: *Put 73 stickers on their boxes*, *Put 1 sticker on its box*; *Put stickers on boxes* dead at none.
 * `ready` is the names with a blank sticker; with the site unread it is every name of the range.
 */
export function onBoxesPressLabel(ready: number): string {
  if (ready <= 0) return 'Put stickers on boxes'
  return `${countedLabel('Put', ready, ['sticker', 'stickers'])} on ${ready === 1 ? 'its box' : 'their boxes'}`
}

/**
 * What the field opens on from a run's row: the run's blank names as a typed range, when one range says exactly
 * those names in that order (`G79-G81`); empty when it cannot, so nothing is guessed.
 */
export function onBoxesPrefill(blankNames: ReadonlyArray<string>): string {
  if (blankNames.length === 0) return ''
  if (blankNames.length === 1) return blankNames[0]!
  const typed = `${blankNames[0]}-${blankNames[blankNames.length - 1]}`
  const read = readStickerRange(typed, 1)
  const same = read.kind === 'names' && read.names.length === blankNames.length && read.names.every((n, i) => n === blankNames[i])
  return same ? typed : ''
}

// ---------------------------------------------------------------------------
// The request and the answer
// ---------------------------------------------------------------------------

export type OnBoxesRequest = { jobId: string; names: string[]; boxKind: BoxKindChoice; placeId: string | null; where: string }

export type OnBoxesVerdict = { ok: true; request: OnBoxesRequest } | { ok: false; words: string }

/** The checks before the press asks the database, in words. The database judges again. */
export function onBoxesRequest(input: { jobId: string | null | undefined; names: ReadonlyArray<string> | null; boxKind: BoxKindChoice; placeId: string | null; where: string }): OnBoxesVerdict {
  if (!input.jobId) return { ok: false, words: 'Pick the job the new boxes go on.' }
  if (!input.names || input.names.length === 0) return { ok: false, words: ON_BOXES_EMPTY_WORDS }
  const where = input.where.trim()
  if (where.length > BOX_WHERE_MAX) return { ok: false, words: `The where line holds ${BOX_WHERE_MAX} characters. This one is ${where.length}.` }
  return { ok: true, request: { jobId: input.jobId, names: [...input.names], boxKind: input.boxKind, placeId: input.placeId, where } }
}

/** `place_sticker_range`'s arguments for a request. */
export function placeStickerRangeArgs(r: OnBoxesRequest): Record<string, unknown> {
  return { p_job_id: r.jobId, p_names: r.names, p_kind: r.boxKind, p_place_id: r.placeId, p_where_note: r.where }
}

/** `place_sticker_range`'s answer, read back. */
export type OnBoxesAnswer = {
  /** A box was made for the name, with its sticker on it. */
  made: string[]
  /** The name was a box on the site already and took its sticker. */
  took: string[]
  /** The name's sticker was on a box already: left as it is. */
  already: string[]
  /** No sticker was printed with the name: nothing was made. */
  noSticker: string[]
  /** The database refused the name's writes: undone, with its reason. */
  held: Array<{ name: string; why: string }>
  /** The stickers that went on a box. */
  stickers: number
}

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])

export function onBoxesAnswerOf(raw: unknown): OnBoxesAnswer | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.ok !== true) return null
  const held = Array.isArray(r.held)
    ? r.held.flatMap((h) => {
        const row = h && typeof h === 'object' ? (h as Record<string, unknown>) : null
        return row && typeof row.name === 'string' && row.name ? [{ name: row.name, why: typeof row.why === 'string' ? row.why : '' }] : []
      })
    : []
  return { made: strings(r.made), took: strings(r.took), already: strings(r.already), noSticker: strings(r.no_sticker), held, stickers: typeof r.stickers === 'number' ? r.stickers : 0 }
}

/** Said when the answer is not one the form can read. */
export const ON_BOXES_UNREAD_ANSWER = 'The answer did not read back. Open the job’s boxes to see what was made.'

/** The fallback when a refusal has no words of its own. */
export const ON_BOXES_FAILED = 'The stickers were not put on boxes.'

/** What became of the press, in sentences, with the names that did not take kept apart with their reasons. */
export type OnBoxesOutcome = {
  /** One sentence a result, in the order a person cares: made, took, already, no sticker. */
  lines: string[]
  /** The head over the held names, null when none was held. */
  heldHead: string | null
  held: Array<{ name: string; why: string }>
  tone: 'success' | 'warning' | 'error'
}

/** `names` is the range as sent, for the spans. */
export function onBoxesOutcome(answer: OnBoxesAnswer, names: ReadonlyArray<string>): OnBoxesOutcome {
  const lines: string[] = []
  const made = answer.made.length
  const took = answer.took.length
  const already = answer.already.length
  const none = answer.noSticker.length
  const held = answer.held.length
  const done = made + took
  if (done === 0) lines.push('No sticker was put on a box.')
  if (made > 0) lines.push(made === 1 ? `1 box made with its sticker on it, ${namesSpanWords(answer.made, names)}.` : `${made} boxes made with their stickers on them, ${namesSpanWords(answer.made, names)}.`)
  if (took > 0) lines.push(took === 1 ? `1 box already on this site took its sticker, ${namesSpanWords(answer.took, names)}.` : `${took} boxes already on this site took their stickers, ${namesSpanWords(answer.took, names)}.`)
  if (already > 0) lines.push(already === 1 ? `1 already had its sticker and was left as it is, ${namesSpanWords(answer.already, names)}.` : `${already} already had their stickers and were left as they are, ${namesSpanWords(answer.already, names)}.`)
  if (none > 0) lines.push(none === 1 ? `1 has no sticker printed, ${namesSpanWords(answer.noSticker, names)}. Nothing was made for it.` : `${none} have no sticker printed, ${namesSpanWords(answer.noSticker, names)}. Nothing was made for them.`)
  const heldHead = held > 0 ? `${held} ${pluralNoun(['name', 'names'], held)} did not go on. ${held === 1 ? 'It stays' : 'They stay'} here with the reason.` : null
  const tone: OnBoxesOutcome['tone'] = held > 0 ? (done > 0 ? 'warning' : 'error') : done > 0 ? 'success' : 'warning'
  return { lines, heldHead, held: answer.held, tone }
}

/** The toast the page shows once the form closes on a result: its first sentence. */
export function onBoxesToast(outcome: OnBoxesOutcome): string {
  return outcome.lines[0] ?? 'No sticker was put on a box.'
}

/** Under the job's words in the form: where a new box lands. */
export function onBoxesGoesOnWords(jobLabel: string): string {
  return `New boxes go on ${jobLabel}.`
}
