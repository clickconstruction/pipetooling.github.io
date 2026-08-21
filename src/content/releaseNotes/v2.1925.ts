import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1925',
  date: '2026-08-20',
  title: 'Payment forecast for billed jobs',
  kind: 'feature',
  highlights: [
    'New Payment forecast button on the Billed Awaiting Payment header: every open bill bucketed by its expected payment date — past expected, this week, next week, and beyond.',
    'The buckets double as a cash-in forecast ("~$35k should land this week") and a follow-up queue (past-expected money listed first).',
    'Click any row to jump straight to that bill on the board.',
  ],
}

export default note
