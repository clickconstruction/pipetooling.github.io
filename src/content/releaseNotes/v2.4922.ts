import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4922',
  date: '2026-10-08',
  title: 'GC mode: the rest of the billing rules move to the real app',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rest of the rules for billing a GC customer move from the prototype, word for word: the monthly pay application line by line, its form, closing out with the customer, and money across the jobs.',
    'Also moved: bill day across every job, what each job makes us, the next six weeks of money, the billing forecast that follows the schedule, asking for the days, and the late finish. Nothing on screen changes yet.',
  ],
}

export default note
