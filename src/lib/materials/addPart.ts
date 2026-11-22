/**
 * Add a part to a box, from the office's Materials desk (v2.8282). A master technician counts as office, so the app
 * sends him to the desk on his phone, and the desk had no way to put a part into a box: a crew lead hit that dead end
 * on 2026-11-22. The desk's box cards and the Edit window's empty Contents tab now open the sheet the Tally's On site
 * tab opens (`tally/AddPartSheet.tsx`), and the row written is the row the Tally writes: a `delivered` movement into
 * the box with the note *added on site*, in the signed-in person's name.
 *
 * Pure: the press's words, the row, and what the toast says. The write is `onSiteStore.addMovement`.
 */
import type { ContainerLine } from './onSite'
import type { OnHandName } from './onSiteNames'
import type { AddMovementInput } from './onSiteStore'
import { rollKey, sameWordsKey } from './siteRollup'

export const ADD_PART_PRESS = 'Add a part'

/** The note on the row, as the Tally's own Add a part writes it: the desk reads such a row as *added on site*. */
export const ADD_PART_NOTE = 'added on site'

/** Said when the write throws and carries no reason of its own. */
export const ADD_PART_FAILED = 'The part was not added.'

/** What the press is called on a box's card, where several cards each have one: *Add a part to G100*. */
export function addPartPressLabel(boxLabel: string): string {
  return `${ADD_PART_PRESS} to ${boxLabel}`
}

/** The picked part as the sheet hands it up. */
export type AddPartPick = { partId: string | null; partName: string; manufacturer: string | null }

/** The movement row for a part added to a box: delivered into it, from nowhere, signed by the person who pressed. */
export function addPartMovement(input: { jobId: string; containerId: string; part: AddPartPick; quantity: number; byUserId: string | null; byName: string }): AddMovementInput {
  return { jobId: input.jobId, partId: input.part.partId, partName: input.part.partName, manufacturer: input.part.manufacturer, quantity: input.quantity, reason: 'delivered', fromContainerId: null, toContainerId: input.containerId, note: ADD_PART_NOTE, byUserId: input.byUserId, byName: input.byName }
}

/** The toast after the row is written: *3 ZZ test elbow added to G100.* */
export function addPartDoneWords(quantity: number, partName: string, boxLabel: string): string {
  return `${quantity} ${partName} added to ${boxLabel}.`
}

/** The words a typed search sends to the parts book: lower case, with PostgREST's own grammar (a comma, a bracket) taken out. Empty when nothing is left. */
export function partSearchWords(term: string): string {
  return term.trim().toLowerCase().replace(/[,()]/g, ' ').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// The sheet's choices (v2.8284): what it offers before a word is typed, and where *as typed* sits
// ---------------------------------------------------------------------------

/** How many of the job's names the sheet lists before anything is typed. */
export const ADD_PART_ALREADY_MAX = 8

/**
 * Words as a part: the name the job already holds when the words are the same, case and spacing aside, with its part
 * id and maker, so the same part is not kept under two spellings. Otherwise the words as typed.
 */
export function pickForWords(names: ReadonlyArray<OnHandName>, words: string): AddPartPick {
  const typed = words.trim().replace(/\s+/g, ' ')
  const key = sameWordsKey(typed)
  const same = key ? names.find((n) => sameWordsKey(n.partName) === key) : undefined
  return same ? { partId: same.partId, partName: same.partName, manufacturer: same.manufacturer } : { partId: null, partName: typed, manufacturer: null }
}

export type AddPartChoices = {
  /** The words for **Use “x” as typed**, the first row under the field. Null with nothing typed, or when a listed name is the same words. */
  asTyped: string | null
  /** **This box says**: the box's own line as a part, one press to use it. Null once a word is typed, or when the box has no line. */
  boxSays: AddPartPick | null
  /** **Already on this job** with nothing typed: the job's names as given, the first eight. Empty once a word is typed, where the match list stands. */
  already: OnHandName[]
}

/**
 * What the sheet offers. With nothing typed it opens on choices: the box's own *What is in it* words, then the names
 * the job already holds. With something typed, the words as typed come first, above every list, where the keyboard
 * cannot hide them; they are left out when a name in `matches` is those same words, since that row is the pick.
 */
export function addPartChoices(input: { term: string; names: ReadonlyArray<OnHandName>; matches: ReadonlyArray<OnHandName>; boxSaid: string | null | undefined }): AddPartChoices {
  const typed = input.term.trim()
  if (!typed) {
    const said = (input.boxSaid ?? '').trim()
    return { asTyped: null, boxSays: said ? pickForWords(input.names, said) : null, already: input.names.slice(0, ADD_PART_ALREADY_MAX) }
  }
  const key = sameWordsKey(typed)
  const listed = input.matches.some((n) => sameWordsKey(n.partName) === key)
  return { asTyped: listed ? null : typed, boxSays: null, already: [] }
}

// ---------------------------------------------------------------------------
// How many (v2.8284)
// ---------------------------------------------------------------------------

/** The chips beside the number: a real load is 27, 50 or 94, never 1. */
export const QUANTITY_CHIPS = [10, 25, 100] as const

/** The most one press adds. */
export const ADD_PART_MAX = 9999

/** A chip's press on the number: added to it, held to the most a press adds. A field still on its opening 1 takes the chip's number itself. */
export function chipAdds(n: number, chip: number, touched: boolean): number {
  return Math.min(ADD_PART_MAX, touched ? n + chip : chip)
}

/** The second press: *Add 40 and another part*. */
export function addAnotherLabel(n: number): string {
  return `Add ${n} and another part`
}

// ---------------------------------------------------------------------------
// A part put into an empty line is counted at that moment (v2.8284, the owner's call)
// ---------------------------------------------------------------------------

/**
 * Whether an add is also the line's count. A person who puts 40 into a box that held none of that part has counted
 * that line: it holds 40. So the app writes the count too, and the box does not ask for a count of what was just put
 * in by hand. When the box already held some, no count is written: the person counted only what they added.
 */
export function addIsItsCount(lines: ReadonlyArray<ContainerLine>, containerId: string, part: Pick<AddPartPick, 'partId' | 'partName'>): boolean {
  const key = rollKey(part)
  return !lines.some((l) => l.containerId === containerId && l.onHand > 0 && rollKey(l) === key)
}

/**
 * The rows one add writes: the part delivered into the box, and after it the line's count at that number when the
 * line held none (`addIsItsCount`). The count is the row **Count this box** writes for a line, a millisecond later so
 * the ledger reads the delivery first.
 */
export function addPartRows(input: { jobId: string; containerId: string; part: AddPartPick; quantity: number; byUserId: string | null; byName: string; lines: ReadonlyArray<ContainerLine>; now: Date }): AddMovementInput[] {
  const { lines, now, ...row } = input
  const delivered: AddMovementInput = { ...addPartMovement(row), at: now.toISOString() }
  if (!addIsItsCount(lines, input.containerId, input.part)) return [delivered]
  const counted: AddMovementInput = { jobId: input.jobId, partId: input.part.partId, partName: input.part.partName, manufacturer: input.part.manufacturer, quantity: input.quantity, reason: 'counted', fromContainerId: input.containerId, toContainerId: null, note: ADD_COUNT_NOTE, byUserId: input.byUserId, byName: input.byName, at: new Date(now.getTime() + 1).toISOString() }
  return [delivered, counted]
}

/** The note on such a count, so History says where it came from. */
export const ADD_COUNT_NOTE = 'counted as added'

// ---------------------------------------------------------------------------
// A new box with its first part (v2.8284)
// ---------------------------------------------------------------------------

export const FIRST_PART_COUNT_LABEL = 'How many'

/** What **How many** holds: nothing (the box alone), a count, or something that is not one. */
export type FirstPartCount = { kind: 'none' } | { kind: 'count'; n: number } | { kind: 'bad'; words: string }

export function firstPartCount(typed: string): FirstPartCount {
  const t = typed.trim()
  if (!t) return { kind: 'none' }
  if (!/^\d+$/.test(t) || Number(t) < 1 || Number(t) > ADD_PART_MAX) return { kind: 'bad', words: `How many is a whole number from 1 to ${ADD_PART_MAX.toLocaleString('en-US')}.` }
  return { kind: 'count', n: Number(t) }
}

/** Said under the fields when a count is typed and the box has no words to name the part by. */
export const FIRST_PART_NEEDS_WORDS = 'Say what is in it, so the count has a part to go on.'

/** The first part of a new box, when a count and the words are both there. The words become the part, matched to a name the job holds. */
export function firstPartOf(names: ReadonlyArray<OnHandName>, said: string | null | undefined, count: FirstPartCount): { part: AddPartPick; n: number } | null {
  const words = (said ?? '').trim()
  if (count.kind !== 'count' || !words) return null
  return { part: pickForWords(names, words), n: count.n }
}

/** The press on Add a container with a first part: *Add G101 with 40 Hangers*. */
export function addBoxWithPartLabel(boxName: string, n: number, partName: string): string {
  return `Add ${boxName} with ${n} ${partName}`
}

/** The toast when both land: *G101 added, with 40 Hangers in it.* */
export function boxWithPartDoneWords(boxName: string, n: number, partName: string): string {
  return `${boxName} added, with ${n} ${partName} in it.`
}

/** The toast when the box lands and the part does not: the box is kept, and the part can be added from it. */
export function boxKeptPartHeldWords(boxName: string, n: number, partName: string, reason: string): string {
  return `${boxName} was added. Its ${n} ${partName} were not: ${reason} Add them from the box.`
}
