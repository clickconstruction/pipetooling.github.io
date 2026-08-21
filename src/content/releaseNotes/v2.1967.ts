import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1967',
  date: '2026-08-21',
  title: 'Partner ledger: charges count at their charge date',
  kind: 'feature',
  highlights: [
    'Back-charges now hit the ledger balance on the date they happened instead of waiting for a statement — one balance, no separate pending math.',
    'Statements still list charges as deductions when you attach them; that\'s the paper record, and nothing double-counts.',
  ],
}

export default note
