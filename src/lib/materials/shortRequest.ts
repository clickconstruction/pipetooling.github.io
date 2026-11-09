/**
 * The Short press (punch list #209, v2.6742): a line on a box is short, so the crew asks the office
 * for more without leaving the box. The ask is the Job Parts Tally's own request — one
 * `jobs_tally_parts` row on the job, the same row the Materials Estimate tab's Send to Office
 * writes, and for a book part the same draft purchase order (`create_po_from_job_tally`) — so what
 * we have and what we need are one screen and the office reads the request where it already
 * reads them (Jobs → Parts). Nothing here touches the ledger: a shortfall is not a movement.
 * Pure: the row, the words. The writes are `shortRequestIo.ts`.
 */
import { countedLabel } from '../batchWords'
import type { ContainerLine } from './onSite'

/** The sheet's ceiling: a request is not capped at what the box has. */
export const SHORT_MAX = 9999

export type ShortRequestRow = {
  job_id: string
  fixture_name: string
  part_id: string | null
  quantity: number
  sequence_order: number
  created_by_user_id: string
}

/** The request row for `n` more of a line's part, in the signed-in person's name. */
export function shortRequestRow(input: { jobId: string; line: Pick<ContainerLine, 'partId' | 'partName' | 'manufacturer'>; n: number; byUserId: string }): ShortRequestRow {
  const name = input.line.manufacturer ? `${input.line.partName} · ${input.line.manufacturer}` : input.line.partName
  return { job_id: input.jobId, fixture_name: name, part_id: input.line.partId, quantity: Math.max(1, Math.round(input.n)), sequence_order: 0, created_by_user_id: input.byUserId }
}

/** The purchase order's entries: a book part makes one, a typed name makes none (the office ties it later). */
export function shortPoEntries(row: Pick<ShortRequestRow, 'part_id' | 'quantity'>): Array<{ part_id: string; quantity: number }> {
  return row.part_id ? [{ part_id: row.part_id, quantity: row.quantity }] : []
}

/** The sheet's button: *Ask the office for 4*. */
export function shortLabel(n: number): string {
  return countedLabel('Ask the office for', n)
}

/** Under the button: what the box has and what the ask is. */
export function shortAfterWords(container: string, onHand: number, n: number): string {
  return `${container} has ${onHand}. The office gets a request for ${n} more.`
}

export type ShortOutcome = { kind: 'po' } | { kind: 'request' } | { kind: 'po-failed'; reason: string }

/** The toast after the row lands: where the office reads it, and whether a draft purchase order was made. */
export function shortToast(n: number, partName: string, outcome: ShortOutcome): string {
  const asked = `Asked the office for ${n} more ${partName}.`
  if (outcome.kind === 'po') return `${asked} A draft purchase order was made, and the request is on the job's Parts tab.`
  if (outcome.kind === 'request') return `${asked} The request is on the job's Parts tab.`
  return `${asked} The request is on the job's Parts tab, but no purchase order was made: ${outcome.reason}`
}

/** A refused row's words. The table lets the office file a request and nobody else, so a crew hears what to say instead. */
export function shortRefusalWords(message: string, n: number, partName: string): string {
  if (/row-level security|permission denied|not allowed/i.test(message)) return `Only the office can file a parts request on this job. Tell them: ${n} more ${partName}.`
  return message
}
