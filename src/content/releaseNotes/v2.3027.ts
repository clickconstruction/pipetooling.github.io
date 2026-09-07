import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3027',
  date: '2026-09-07',
  title: 'Safety net under sending an invoice back',
  kind: 'fix',
  highlights: [
    'Sending a billed invoice back — from a job revert, a write-down or a subcontractor’s Collect Payment — now has 9 tests pinning which lines are voided in Stripe, how the ledger line is removed, and how each failure reads; no behaviour change.',
  ],
}

export default note
