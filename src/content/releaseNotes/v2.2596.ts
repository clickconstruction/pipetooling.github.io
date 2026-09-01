import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2596',
  date: '2026-09-01',
  title: 'Who owes what: every bill shows its address and line items',
  kind: 'feature',
  highlights: [
    'Expanding a customer in the Who-owes-what view now shows each bill as its own card: job name and number, the job site address, and the line items that bill covers — with the amount and age chip at the top right.',
    'Line items come from the job\'s Specific Work lines, scoped to the bill: a partial bill with no lines carved out for it shows no list, so a card never lists more work than the bill asks for.',
    'View on board still jumps straight to that bill, and the fresh (under-30-day) age chips got a visible outline so they read as chips everywhere.',
  ],
}

export default note
