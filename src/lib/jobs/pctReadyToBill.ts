/**
 * Ready to Bill from the percent window (v2.7260).
 *
 * The owner, setting percents from the Bridge: "if we set it to a hundred percent, that probably means we're ready to
 * bill. So we should probably add an option where when someone sets a job to a hundred percent, they can move it to
 * ready to bill from that modal". Asked for the best shape, he took this one: a line in the window itself, one tick
 * for everyone, and no hold on a job with no price.
 *
 * Before, a save at 100% on a Working job opened a second window with two checkboxes and its own press: five presses
 * across two windows, and nobody knew the offer was there until after the save. Now the line appears the moment the
 * number reaches 100, the one tick stands for both of the old statements, whose words sit under it, and Save says
 * what it will do. It is off until ticked: a job's status is a bigger thing to move than its number.
 *
 * Pure: the words and the rules. `FieldPctUpdateModal` draws them and `markJobReadyToBill` makes the move.
 */

export const READY_TO_BILL_WORDS = {
  /** The tick's own words. */
  tick: 'Also move to Ready to Bill',
  /** What the tick says for the person who ticks it: the two statements the old window asked for one at a time. */
  attest: 'Parts are reported, and the customer knows the work is done.',
  /** After a save whose move was refused: the percent is safe, and the reason follows. */
  held: 'The percent is saved. The job did not move to Ready to Bill.',
  /** The press that tries the move again, alone. */
  retry: 'Move to Ready to Bill',
  /** The press that leaves the job where it is. */
  leave: 'Leave it in Working',
} as const

/** The line is offered when the save would write 100 on a job that is Working. Any other number or status: no line. */
export function readyToBillOffered(input: { saveValue: number | null; status: string | null }): boolean {
  return input.saveValue === 100 && input.status === 'working'
}

/** Save's words with the move named on it when the tick is on: *Save 100% and move to Ready to Bill*. */
export function pctSaveLabel(base: string, willMove: boolean): string {
  return willMove ? `${base} and move to Ready to Bill` : base
}

/**
 * What follows a saved percent. The move is made only when it was asked for and the job is still Working once the
 * percent has landed: someone else may have moved it while the window was open, and then there is nothing to do.
 */
export function afterPctSave(input: { willMove: boolean; statusAfter: string | null }): 'move' | 'close' {
  return input.willMove && input.statusAfter === 'working' ? 'move' : 'close'
}

/** The line under the note when a move was refused: that the percent is safe, then the reason as it was given. */
export function readyToBillHeldWords(reason: string): string {
  const r = reason.trim()
  return r ? `${READY_TO_BILL_WORDS.held} ${r}` : READY_TO_BILL_WORDS.held
}
