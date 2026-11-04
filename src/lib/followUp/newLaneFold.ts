/**
 * The sort card folded to one row on a short window (v2.6476, the owner's pick A, 2026-11-03): the card's head on one
 * line, then the one press the card already picked, so the common answer stays one press away while the thread's lines
 * get the room. *Other ways* opens the whole card in place. This says which press leads, if any.
 */
import type { BidCustomerChoice, JobChoice, NewLaneRow } from './newLane'

/** The press a folded card leads with: start the bid on the customer it found, keep the line on its job, or ask who. */
export type FoldedLead =
  | { kind: 'bid'; label: string; choice: BidCustomerChoice; projectName: string }
  | { kind: 'job'; label: string; jobId: string }
  | { kind: 'who'; label: string }

/** What opens the whole card: *Other ways* beside a lead press, *Open* when the card has none. */
export const FOLD_OPEN = { withLead: 'Other ways', alone: 'Open' } as const
/** The open card's press back to its one row. */
export const FOLD_SHUT = 'Fold'

/**
 * The lead press for a folded card. *Bid it?*: the first customer it found, once the bid has a name. *Which job?*: the
 * job picked, the default first. *Who is this?*: the search, as the card's own head offers it. *Who has it?* leads with
 * none, since the right person is a choice the card shows whole.
 */
export function foldedLead(
  row: Pick<NewLaneRow, 'sort' | 'invitation'>,
  facts: { bidChoices?: readonly BidCustomerChoice[] | null; pickedJob?: JobChoice | null },
): FoldedLead | null {
  if (row.sort === 'bid') {
    const choice = facts.bidChoices?.[0]
    const projectName = row.invitation?.project?.trim() ?? ''
    return choice && projectName ? { kind: 'bid', label: choice.label, choice, projectName } : null
  }
  if (row.sort === 'job') {
    const job = facts.pickedJob
    return job ? { kind: 'job', label: job.isDefault ? `Keep it on ${job.number}` : `Move it to ${job.number}`, jobId: job.id } : null
  }
  if (row.sort === 'who') return { kind: 'who', label: 'Who is this?' }
  return null
}
