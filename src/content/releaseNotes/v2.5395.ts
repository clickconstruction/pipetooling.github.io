import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5395',
  date: '2026-10-12',
  title: 'Messages: where a residential customer is on their job, read from what the app keeps, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The app can now read where a homeowner is on each of their jobs: booked, on the way, arrived, what we found, the estimate, their yes, working, done, billed, paid and the review ask.',
    'Each step reads what the app already keeps: the dispatch board, clock-ins, field reports, estimates, the Jobs board, bills, payments and our texts.',
    'Each bill is its own round on Billed and Paid, due the day the expected pay chip reads.',
    'Nothing on screen changes yet. The residential flow and the strip above the reply box come next.',
  ],
}

export default note
