import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5956',
  date: '2026-10-26',
  title: 'Evening times land on their own day across the app',
  kind: 'fix',
  highlights: [
    'Anything logged after 7 PM used to read as tomorrow in many places. It now reads as the day it happened, counted on the office’s own calendar.',
    'Collect on the Bridge reads an evening call as that day’s call, and its back-on-the-sheet day counts from there.',
    'A pay payment marked in the evening lands on its own day in the person’s money, the pay run, the Cash App match and the partner ledger with its pay report.',
    'Supply-house move asks, saved GC scope sets, job follow-ups, a paid claim’s wrote day, court areas, the owner records packet and the customer portal’s sent day all date by the office’s day too.',
  ],
}

export default note
