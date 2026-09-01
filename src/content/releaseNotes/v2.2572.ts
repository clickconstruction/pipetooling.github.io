import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2572',
  date: '2026-09-01',
  title: 'The AR customer list becomes a call sheet',
  kind: 'feature',
  highlights: [
    'Customer rows in the Accounts Receivable drill-down now wear their chase state — Owes a call, Promised (date), Promise broken, Dispute open, or quiet after a recent touch.',
    'Expanding a customer keeps their bills and line items up front, then adds the call card: a ready-made opener, their last payments as speed chips, and the last touch on record.',
    'One-tap outcomes from the card — “They promised…” with a date, “Can’t reach — snooze 7d”, and Copy summary for a text or email — all feed the same Payment Chase queue the Pipeline uses.',
  ],
}

export default note
