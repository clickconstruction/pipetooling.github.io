/**
 * A run that names its boxes (punch list #329, design section 10, v2.7312): what a typed range of box names means.
 * The owner, 2026-11-15: print stickers that already say G1 to G200, or G78 to G300, so the sticker on the cage is
 * the name painted on it. A name is the box rule's (#351, `boxName.ts`): one to three letters, 1 to 999 with no zero
 * in front, one letter after or none, seven characters at most. On the paint the plain name is the first cage at a
 * spot and B the second (G24 and G24B, never G24A).
 *
 * A range is two names with a dash between, or one name and the count. The parts of the two ends that differ step,
 * the parts that match stay: `G78-300` steps the number; `A1-D50` the letter and the number, four rows of fifty, row
 * by row; `G78B-D` the letter after, twins at one spot; `G1-100C` reads plain, B, C for every spot, the letter after
 * the innermost step so a spot's cages print together. All three parts stepping, a range running downward, a name off
 * the rule, a name past 999 and a run over 500 are refused in words. The end may be a whole name, a number, a number
 * with a letter after, or a bare letter after; ` to ` and the long dashes read as the dash; the case does not matter.
 *
 * Pure. The list it makes goes to `mint_sticker_run` as `p_names` (`20261115050000_sticker_run_names.sql`), where the
 * database holds what it can check on the list itself: each name under the rule, as many as the stickers, each once.
 * The database reads no range, so the shorthand has one home. The mock-up's rule table in
 * `to-dos/stickers-before-boxes/mockup-named-runs.html` is this file's test list. The window's Names field (PR 8,
 * v2.7391) reads through `stickerNamesAsk`, and its two notices at print are `liveNamesNotice` and `blankNamesNotice`.
 */
import { BOX_NAME_RULE, BOX_NAME_RULE_WORDS, boxNameWords, nextFreeName, parseBoxName, type BoxName, type SiteBox } from './boxName'
import { STICKER_RUN_MAX } from './stickerRun'
import { BOX_NUMBER_MAX } from './boxName'

export type StickerRange =
  /** Nothing typed: the run's stickers carry no name, only their code. */
  | { kind: 'unnamed' }
  | {
      kind: 'names'
      /** In print order. */
      names: string[]
      first: string
      last: string
      /** More than one when the letters step: the rows of a grid. */
      rows: number
      /** Why it reads so: *The number steps.*, *4 rows of 50, A to D, row by row.* */
      why: string
    }
  | { kind: 'refused'; words: string }

/** The letters of a name step on the last letter only, upward: A to D, GA to GD. Null when they cannot. */
function stepLetters(from: string, to: string): string[] | null {
  if (from.length !== to.length || from.slice(0, -1) !== to.slice(0, -1)) return null
  const a = from.charCodeAt(from.length - 1)
  const b = to.charCodeAt(to.length - 1)
  if (b < a) return null
  const out: string[] = []
  for (let c = a; c <= b; c++) out.push(from.slice(0, -1) + String.fromCharCode(c))
  return out
}

/** The letters after the number from a start to an end: from a plain start, plain then B on; from a letter, that letter on. */
function stepTails(from: string, to: string): string[] | null {
  if (from === to) return [from]
  if (from && !to) return null
  if (!from) return [''].concat(to > 'A' ? (stepLetters('B', to) ?? []) : [])
  return stepLetters(from, to)
}

/** A range that runs downward, in words. */
function upwardWords(a: BoxName, b: BoxName): string {
  return `The range runs upward: ${boxNameWords(b)} to ${boxNameWords(a)}.`
}

export const STICKER_RANGE_SHAPE_WORDS = 'A range is two names with one dash between, like G78-300.'
export const STICKER_RANGE_AXES_WORDS = 'A range steps the number, the letter or both. Not all three.'
export const STICKER_RANGE_LETTERS_WORDS = 'The letters step on the last letter only, A to D or GA to GD, upward.'

/** A run is 1 to 500 stickers, with the range's own count. */
export function stickerRangeTooLongWords(a: BoxName, b: BoxName, count: number): string {
  return `A run is 1 to ${STICKER_RUN_MAX} stickers. ${boxNameWords(a)} to ${boxNameWords(b)} is ${count}.`
}

/** The typed text as the parser reads it: capitals, no spaces, ` to ` and the long dashes as the dash. */
export function normalizeStickerRange(typed: string): string {
  return String(typed ?? '')
    .toUpperCase()
    .replace(/\s+TO\s+/g, '-')
    .replace(/\s+/g, '')
    .replace(/[–—]/g, '-')
}

/**
 * What a typed range means. `howMany` is the count when one name is typed alone: the names start there and stop at
 * 999 with its words.
 */
export function readStickerRange(typed: string, howMany: number): StickerRange {
  const t = normalizeStickerRange(typed)
  if (!t) return { kind: 'unnamed' }
  const parts = t.split('-')
  if (parts.length > 2) return { kind: 'refused', words: STICKER_RANGE_SHAPE_WORDS }
  const a = parseBoxName(parts[0]!)
  if (!a) return { kind: 'refused', words: BOX_NAME_RULE_WORDS }
  if (parts.length === 1) {
    const count = Math.max(1, Math.min(STICKER_RUN_MAX, Math.floor(Number(howMany)) || 1))
    let last = a.number + count - 1
    const cut = last > BOX_NUMBER_MAX
    if (cut) last = BOX_NUMBER_MAX
    const names: string[] = []
    for (let n = a.number; n <= last; n++) names.push(`${a.letters}${n}${a.tail}`)
    return {
      kind: 'names',
      names,
      first: names[0]!,
      last: names[names.length - 1]!,
      rows: 1,
      why: cut ? `Names stop at ${a.letters}${BOX_NUMBER_MAX}${a.tail}, so the run is ${names.length}.` : `From ${boxNameWords(a)}, How many says how far.`,
    }
  }
  const short = /^([1-9][0-9]{0,2})([A-Z])?$/.exec(parts[1]!)
  const b: BoxName | null = short
    ? { letters: a.letters, number: Number(short[1]), tail: short[2] ?? a.tail }
    : /^[A-Z]$/.test(parts[1]!)
      ? { letters: a.letters, number: a.number, tail: parts[1]! }
      : parseBoxName(parts[1]!)
  if (!b) return { kind: 'refused', words: BOX_NAME_RULE_WORDS }
  const lettersStep = a.letters !== b.letters
  const numberStep = a.number !== b.number
  const tailStep = a.tail !== b.tail
  if (lettersStep && numberStep && tailStep) return { kind: 'refused', words: STICKER_RANGE_AXES_WORDS }
  const letters = lettersStep ? stepLetters(a.letters, b.letters) : [a.letters]
  if (!letters) return { kind: 'refused', words: STICKER_RANGE_LETTERS_WORDS }
  if (b.number < a.number) return { kind: 'refused', words: upwardWords(a, b) }
  const tails = stepTails(a.tail, b.tail)
  if (!tails) return { kind: 'refused', words: upwardWords(a, b) }
  const names: string[] = []
  for (const L of letters) for (let n = a.number; n <= b.number; n++) for (const T of tails) names.push(`${L}${n}${T}`)
  if (names.length > STICKER_RUN_MAX) return { kind: 'refused', words: stickerRangeTooLongWords(a, b, names.length) }
  const rows = letters.length
  const why =
    rows > 1
      ? `${rows} rows of ${names.length / rows}, ${letters[0]} to ${letters[letters.length - 1]}, row by row.`
      : tails.length > 1 && !a.tail
        ? `Each spot gets the plain name, then ${tails.length > 2 ? `B to ${b.tail}` : 'B'}: the twins behind it.`
        : tails.length > 1
          ? 'The letter after the number steps: a set of twins at one spot.'
          : 'The number steps.'
  return { kind: 'names', names, first: names[0]!, last: names[names.length - 1]!, rows, why }
}

/** The read line under the field: *G78 to G300 · 223 stickers. The number steps.*; the refusal's words; the line for a run with no names. */
export function stickerRangeWords(range: StickerRange): string {
  if (range.kind === 'refused') return range.words
  if (range.kind === 'unnamed') return 'Nothing typed: the stickers carry no name, only their code. A leftover works on any site.'
  const n = range.names.length
  return `${range.first} to ${range.last} · ${n} ${n === 1 ? 'sticker' : 'stickers'}. ${range.why}`
}

/** Whether a typed text set the end itself, so How many follows it rather than the other way. */
export function stickerRangeSetsCount(typed: string): boolean {
  return normalizeStickerRange(typed).includes('-')
}

/**
 * The next twin at a spot, for a sticker whose name the site already carries and a person who says it is a different
 * box (PR 9): G78B when G78 is live and no G78B, G78C when G78B stands. Null when the name is off the rule, when its
 * plain name is not a live box, or past Z.
 */
export function nextTwinName(boxes: ReadonlyArray<SiteBox>, name: string): string | null {
  const n = parseBoxName(name)
  if (!n) return null
  const live = new Set(boxes.filter((b) => !b.retiredAt).map((b) => b.label.trim().toUpperCase()))
  const plain = `${n.letters}${n.number}`
  if (!live.has(plain) && !live.has(name.trim().toUpperCase())) return null
  for (let c = 'B'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) {
    const twin = `${plain}${String.fromCharCode(c)}`
    if (!live.has(twin)) return twin
  }
  return null
}

/** The rule as a name is held on a sticker: `BOX_NAME_RULE`, for a reader that has only this file. */
export const STICKER_NAME_RULE = BOX_NAME_RULE

// ---------------------------------------------------------------------------
// The window's Names field (PR 8, v2.7391)
// ---------------------------------------------------------------------------

/** The field's label and what it shows while empty. */
export const STICKER_NAMES_LABEL = 'Names'
export const STICKER_NAMES_PLACEHOLDER = 'G78, or G78-300'

/** Said under the field while the site's boxes are read: the press waits, so nobody prints a run with no names by being quick. */
export const STICKER_NAMES_READING_WORDS = 'Reading the site’s names…'

/** Said under the field when the site's boxes did not load: the field takes a typed range, and the two notices cannot be given. */
export const STICKER_NAMES_UNREAD_WORDS = 'The site’s names did not load, so no name is offered and nothing is checked against the site.'

/** What the field makes of what is typed, with How many: the range, the count the run will have and the line under the field. */
export type StickerNamesAsk = {
  range: StickerRange
  /** The stickers the run will have: the names' count, or How many for a run with no names. Zero when refused. */
  count: number
  /** The typed range set its own end, so How many shows the count and its presses are dead. */
  countFollows: boolean
  /** The line under the field. */
  words: string
  tone: 'ok' | 'refused'
}

/**
 * The Names field read. `offered` is the site's next free name the field opened on: while it stands untouched the
 * line says so, since nobody typed it.
 */
export function stickerNamesAsk(typed: string, howMany: number, offered?: string | null): StickerNamesAsk {
  const range = readStickerRange(typed, howMany)
  const countFollows = range.kind === 'names' && stickerRangeSetsCount(typed)
  if (range.kind === 'refused') return { range, count: 0, countFollows: false, words: range.words, tone: 'refused' }
  if (range.kind === 'unnamed') return { range, count: Math.max(0, Math.floor(Number(howMany)) || 0), countFollows: false, words: stickerRangeWords(range), tone: 'ok' }
  const n = range.names.length
  const isOffer = !!offered && normalizeStickerRange(typed) === offered.toUpperCase() && !range.why.startsWith('Names stop')
  const words = isOffer ? `${range.first} to ${range.last} · ${n} ${n === 1 ? 'sticker' : 'stickers'}. ${range.first} is the site’s next free name. Type a range to set the end, like ${range.first}-${Math.min(BOX_NUMBER_MAX, parseBoxName(range.first)!.number + 99)}.` : stickerRangeWords(range)
  return { range, count: n, countFollows, words, tone: 'ok' }
}

/** Some of a run's names, in words: `G78`, `G78 and G80`, `G78 to G150` when they are one unbroken stretch of the run, `G78, G80 and 5 more` when not. */
export function namesSpanWords(some: ReadonlyArray<string>, runNames: ReadonlyArray<string>): string {
  if (some.length === 0) return ''
  if (some.length === 1) return some[0]!
  const at = runNames.indexOf(some[0]!)
  const unbroken = at >= 0 && some.every((name, i) => runNames[at + i] === name)
  if (unbroken) return `${some[0]} to ${some[some.length - 1]}`
  if (some.length === 2) return `${some[0]} and ${some[1]}`
  return `${some[0]}, ${some[1]} and ${some.length - 2} more`
}

/**
 * The name a new run opens on (v2.7487): one past the highest number the site's boxes carry and the highest a
 * reserved sticker holds, so a second run starts after the first where it used to open on the first's own names and
 * meet the hold. A reserved name counts as a box of that name does. Null on a site with no name yet.
 */
export function nextNameToReserve(boxes: ReadonlyArray<SiteBox>, reservedNames: ReadonlyArray<string>): string | null {
  return nextFreeName([...boxes, ...reservedNames.map((label) => ({ label, kind: 'box', retiredAt: null }))])
}

/**
 * The first notice at print: names of the run that are live boxes on the site already. This is the backfill, and the
 * default, so it is a notice and never a hold: *77 of these are boxes on this site already, G1 to G77. Their stickers
 * go on those boxes.* Null when none is.
 */
export function liveNamesNotice(names: ReadonlyArray<string>, boxes: ReadonlyArray<SiteBox>): { names: string[]; words: string } | null {
  const live = new Set(boxes.filter((b) => !b.retiredAt && b.kind !== 'unsorted').map((b) => b.label.trim().toUpperCase()))
  const taken = names.filter((n) => live.has(n))
  if (taken.length === 0) return null
  const span = namesSpanWords(taken, names)
  const words = taken.length === 1 ? `1 of these is a box on this site already, ${span}. Its sticker goes on that box.` : `${taken.length} of these are boxes on this site already, ${span}. Their stickers go on those boxes.`
  return { names: taken, words }
}

/**
 * The second notice, and the one hold: names of the run that an earlier run printed and that are on no box yet.
 * Printing them again leaves two stickers for one name in two drawers, so the press waits for **Print them anyway**.
 * `blankNames` are the names on the site's stickers that are blank and not lost. Null when none overlaps.
 */
export function blankNamesNotice(names: ReadonlyArray<string>, blankNames: ReadonlyArray<string>): { names: string[]; words: string; anywayLabel: string } | null {
  const blank = new Set(blankNames.map((n) => n.trim().toUpperCase()))
  const again = names.filter((n) => blank.has(n))
  if (again.length === 0) return null
  const span = namesSpanWords(again, names)
  const words = again.length === 1
    ? `1 of these is reserved by an earlier run and is not on a box yet, ${span}. Printing it again makes two stickers for one name.`
    : `${again.length} of these are reserved by an earlier run and are not on a box yet, ${span}. Printing them again makes two stickers for each name.`
  return { names: again, words, anywayLabel: again.length === 1 ? 'Print it anyway' : 'Print them anyway' }
}
