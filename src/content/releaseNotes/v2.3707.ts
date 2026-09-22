import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3707',
  date: '2026-09-22',
  title: 'Contract amount: the job’s number, read from its line items — never typed',
  kind: 'feature',
  highlights: [
    'On the Contract sweep and in the Contract window, the amount is no longer a box. It reads the job’s number with where it comes from — from the job’s 14 line items, or from the estimate the customer accepted Sep 12 — and Adjust line items › opens the job. Change the line items and the agreement follows, so a signed agreement and the bill can never disagree.',
    'A job with no line items reads No amount — the agreement says time and materials, with Add line items › to fix it.',
    'A draft that still carries a number typed before this is named, not rewritten: the row wears Amount differs, Send all skips it, the pane says what the draft says beside what the job says, and Use the job’s $… puts the job’s number on it in one press. Nothing sends until it does.',
  ],
}

export default note
