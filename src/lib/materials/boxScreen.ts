/**
 * Materials on site: the words and the rules of a box's own screen on the phone (punch list #398). The screen
 * is the box's name, its parts as closed rows, then four tiles that each carry their own fact (Count, Photo, Add
 * a part, Where is it?), with the rare presses behind **More**. A press is sized by how often the crews use it:
 * the ledger held 162 counts and 94 box photos against 3 presses of Used and 1 of Can't find.
 *
 * Pure. The screen is `components/tally/OnSiteBoxScreen.tsx`; the sheets behind every press are the tab's own.
 */
import { calendarYmdInAppTzFromIso, formatWorkDateYmdMonthDayShort, todayYmdInAppTz } from '../../utils/dateUtils'
import { boxKindWords } from './editBox'
import { sayItBetterPress, type BoxLine } from './boxLine'
import { countIsDue, daysSince, lastCountWords, type Container, type ContainerKind, type ContainerLine } from './onSite'

/** The press that asks the office for more of a part. It read **Short** until #398: a short count means missing. */
export const ASK_MORE_PRESS = 'Ask for more'
/** The one press that holds what a crew member rarely needs: edit, say, move, the paper, retire. */
export const BOX_MORE_PRESS = 'More'
/** Under the parts, once: how a part's own presses are reached. */
export const PART_HINT = 'Tap a part if some are missing, moved or needed.'
/** Over a box's own photos. Its takes come under them with their own heading, `Taken from G12` (`BoxTakes`). */
export const BOX_PHOTOS_CAPTION = 'Photos'

/** Over the parts: `In G12`. */
export function partsCaption(label: string): string {
  return `In ${label}`
}

/** The sheet's title: `More for G12`. */
export function moreTitle(label: string): string {
  return `More for ${label}`
}

const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// ── the tiles ───────────────────────────────────────────────────────────────────────────────────

export type BoxTileKey = 'count' | 'photo' | 'add' | 'where'

/**
 * The tiles a box draws, in the order of use. Count needs a line to walk. Unsorted is the app's own row: it has no
 * place, no photo and no count, so it keeps Add a part alone.
 */
export function boxTiles(input: { kind: ContainerKind; walkable: number }): BoxTileKey[] {
  if (input.kind === 'unsorted') return ['add']
  return [...(input.walkable > 0 ? (['count'] as const) : []), 'photo', 'add', 'where']
}

/** The Count tile's name: `Count G12`. */
export function countTileTitle(label: string): string {
  return `Count ${label}`
}

/** The Count tile's fact: when it was counted and by whom, or that a count is due. `due` turns the tile amber. */
export function countTileFact(last: { at: string; byName: string } | null, now: Date): { words: string; due: boolean } {
  const due = countIsDue(last, now)
  if (!last) return { words: 'Never counted', due }
  if (!due) return { words: capital(lastCountWords(last, now)), due }
  const days = daysSince(last.at, now)
  return { words: `Due. Last counted ${days} days ago`, due }
}

/** What a photo taken in the minutes after a press is of, said on the tile: the chip used to turn blue and say nothing. */
function freshPhotoWords(label: string, after: string): string {
  if (after === 'Count') return `Of ${label} as you counted it`
  if (after === 'Add a part') return `Of ${label} with the part you added`
  if (after === 'Put in' || after === 'Move') return `Of ${label} with what went in`
  return `Of ${label} after ${after}`
}

/**
 * The Photo tile's fact: how many the box has and the newest one's day, or what a photo taken now would be of when
 * something was just done to the box (`after`, as `actIsFresh` holds it). `fresh` outlines the tile blue.
 */
export function photoTileFact(input: { label: string; photos: ReadonlyArray<{ at: string }>; after: string | null; now: Date }): { words: string; fresh: boolean } {
  if (input.after) return { words: freshPhotoWords(input.label, input.after), fresh: true }
  const n = input.photos.length
  if (n === 0) return { words: 'None yet', fresh: false }
  const newest = input.photos.reduce((best, p) => (p.at > best ? p.at : best), input.photos[0]!.at)
  const ymd = calendarYmdInAppTzFromIso(newest)
  const day = ymd === todayYmdInAppTz(input.now) ? 'today' : formatWorkDateYmdMonthDayShort(ymd)
  return { words: `${n} so far, ${day}`, fresh: false }
}

/** A filed photo's day under its thumbnail: `Nov 17`, or `today`. A filed photo says no more than its day and who took it. */
export function boxPhotoDayWords(p: { at: string }, now: Date = new Date()): string {
  const ymd = calendarYmdInAppTzFromIso(p.at)
  return ymd === todayYmdInAppTz(now) ? 'Today' : formatWorkDateYmdMonthDayShort(ymd)
}

/** The Add a part tile's fact: how many kinds of part the box holds now. */
export function addTileFact(label: string, kinds: number): string {
  if (kinds <= 0) return `The first part in ${label}`
  return `${kinds} ${kinds === 1 ? 'kind' : 'kinds'} in ${label} now`
}

/** The Where is it? tile's fact: the place, the where line and the pin's mark (`boxPinShort`), or that it has none. */
export function whereTileFact(input: { place: string | null; where: string; pin: string | null }): string {
  const where = input.where.trim()
  const head = [input.place ?? '', where].filter(Boolean).join(', ')
  if (!head) return input.pin ? `No place yet, ${input.pin}` : 'No place yet'
  return `${head}, ${input.pin ?? 'no pin yet'}`
}

// ── a part's row ────────────────────────────────────────────────────────────────────────────────

export type PartPress = 'put-in' | 'used' | 'move' | 'cannot_find' | 'short'

/** The words on each of a part's presses. */
export const PART_PRESS_WORDS: Record<PartPress, string> = {
  'put-in': 'Put in…',
  used: 'Used',
  move: 'Move to…',
  cannot_find: "Can't find",
  short: ASK_MORE_PRESS,
}

/**
 * The presses an open part shows, in today's order. Unsorted leads with **Put in…** and has no Move to…. A part with
 * none left keeps the ask for more alone, since that line is the one most often short.
 */
export function partPresses(input: { unsorted: boolean; onHand: number }): PartPress[] {
  if (input.onHand <= 0) return ['short']
  return input.unsorted ? ['put-in', 'used', 'cannot_find', 'short'] : ['used', 'move', 'cannot_find', 'short']
}

/** Unsorted's parts open by themselves: putting them in a box is that screen's whole point. */
export function partsOpenByThemselves(kind: ContainerKind): boolean {
  return kind === 'unsorted'
}

/** What a row says under its part when something is wrong with it; empty when nothing is. The row then wears amber. */
export function partRowNote(line: Pick<ContainerLine, 'cannotFindSinceCount' | 'lastCountDiff'>): string {
  const missing = -(line.lastCountDiff ?? 0)
  return [line.cannotFindSinceCount > 0 ? `${line.cannotFindSinceCount} can't find` : '', missing > 0 ? `${missing} missing at the last count` : ''].filter(Boolean).join(', ')
}

/** Under a part with none left, where its presses would be. */
export function noneLeftWords(label: string): string {
  return `${label} has none left.`
}

// ── More ────────────────────────────────────────────────────────────────────────────────────────

export type MoreKey = 'edit' | 'say' | 'move' | 'label' | 'manifest' | 'copy' | 'retire'
export type MoreRow = { key: MoreKey; title: string; sub: string; /** Drawn apart at the bottom, so a thumb reaching for a print never lands on it. */ apart?: true }

/** What the say row reads under its name: the line as it stands and who wrote it. */
function sayRowSub(line: BoxLine): string {
  if (line.by === 'none' || !line.text) return 'Nothing says what is in it yet'
  return line.by === 'app' ? `Now: ${line.text}, from its parts` : `Now: ${line.text}, in a person’s words`
}

/** The rows of **More**, each with one line that says what it does. Every sheet behind a row is the tab's own. */
export function moreRows(box: Pick<Container, 'label' | 'kind'>, line: BoxLine): MoreRow[] {
  return [
    { key: 'edit', title: `Edit ${box.label}`, sub: 'Its name, how it sits and where exactly' },
    { key: 'say', title: sayItBetterPress(line), sub: sayRowSub(line) },
    { key: 'move', title: `Move ${box.label}`, sub: 'To another place on this site' },
    { key: 'label', title: 'Print the label', sub: 'On a paper sheet or on Brother tape' },
    { key: 'manifest', title: 'Print the manifest', sub: 'A page that lists what is in it' },
    { key: 'copy', title: 'Copy the label code', sub: 'For Brother’s phone app' },
    { key: 'retire', title: `Retire ${box.label}`, sub: `When the ${boxKindWords(box.kind).toLowerCase()} leaves the job`, apart: true },
  ]
}
