/**
 * The won bid's Submittals chip, the words (Submittals stage 4b): where the bid's
 * newest revision stands, for the Bid Board row.
 */
import { REVISION_STATUS_LABELS } from './submittalRevision'

export type BidSubmittalSummary = {
  revNumber: number
  status: 'draft' | 'shared' | 'reviewed' | 'superseded'
  roomStatus: 'open' | 'closed' | null
  /** People who may decide and have not opened their link, by name. */
  waitingOn: string[]
  /** Rows marked Revise or Reject on that revision. */
  sentBack: number
} | null

/** "Rev 2 · shared · waiting on Dana W." · "Rev 2 · shared · 3 rows sent back" · "Rev 1 · draft" · "room closed". */
export function describeBidSubmittal(s: NonNullable<BidSubmittalSummary>): string {
  if (s.roomStatus === 'closed') return `Rev ${s.revNumber} · room closed`
  const parts = [`Rev ${s.revNumber}`, REVISION_STATUS_LABELS[s.status]]
  if (s.status === 'shared') {
    if (s.sentBack > 0) parts.push(`${s.sentBack} row${s.sentBack === 1 ? '' : 's'} sent back`)
    else if (s.waitingOn.length > 0) parts.push(`waiting on ${s.waitingOn.slice(0, 2).join(', ')}${s.waitingOn.length > 2 ? ` +${s.waitingOn.length - 2}` : ''}`)
  }
  return parts.join(' · ')
}
