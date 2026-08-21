import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1951',
  date: '2026-08-21',
  title: 'Partner ledger: pending charges sit in line by date',
  kind: 'feature',
  highlights: [
    'Back-charges and other pending items now appear inside the Ledger journal at their own date, wearing a "pending" chip, instead of in a separate box above.',
    'They show their amount but an empty balance — the running balance still moves only when a statement attaches them.',
  ],
}

export default note
