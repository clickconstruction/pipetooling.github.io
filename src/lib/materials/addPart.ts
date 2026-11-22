/**
 * Add a part to a box, from the office's Materials desk (v2.8282). A master technician counts as office, so the app
 * sends him to the desk on his phone, and the desk had no way to put a part into a box: a crew lead hit that dead end
 * on 2026-11-22. The desk's box cards and the Edit window's empty Contents tab now open the sheet the Tally's On site
 * tab opens (`tally/AddPartSheet.tsx`), and the row written is the row the Tally writes: a `delivered` movement into
 * the box with the note *added on site*, in the signed-in person's name.
 *
 * Pure: the press's words, the row, and what the toast says. The write is `onSiteStore.addMovement`.
 */
import type { AddMovementInput } from './onSiteStore'

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
