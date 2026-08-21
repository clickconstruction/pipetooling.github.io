import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1956',
  date: '2026-08-21',
  title: 'Partner ledger: pending tag removed',
  kind: 'fix',
  highlights: [
    'The amber "pending" tag on inline ledger rows is gone — a charge waiting for its statement now reads as an ordinary row with a "—" balance, explained in the footer.',
  ],
}

export default note
