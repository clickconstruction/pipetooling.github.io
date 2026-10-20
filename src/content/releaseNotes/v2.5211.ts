import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5211',
  date: '2026-10-10',
  title: 'GC mode: the customer sees their schedule in their portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A GC customer’s portal now opens each job we are building with their schedule: the finish against their contract, each stage, the dates to meet, what changed this week and what we need from them.',
    'A customer who is a GC or an owner’s rep can see every bar. No customer ever sees a trade, a dollar or a spare day.',
    'The schedule letter and the Friday report now end with a link to their schedule in the portal. The Friday report leaves it off when the architect is copied.',
  ],
}

export default note
