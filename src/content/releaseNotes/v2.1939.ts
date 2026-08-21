import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1939',
  date: '2026-08-21',
  title: 'Partner ledger balance now counts pending charges',
  kind: 'feature',
  highlights: [
    'The Partnerships → Ledger headline is now the settle-up position: posted balance plus charges still waiting for a statement, with both parts shown beside it.',
    'Pending charges get their own itemized block above the journal — each with its date and amount — instead of a one-line count.',
    'The partner\'s own dashboard card shows the same "with pending charges" figure, so both sides quote one number.',
  ],
}

export default note
