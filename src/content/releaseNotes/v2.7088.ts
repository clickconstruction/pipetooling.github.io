import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7088',
  date: '2026-11-12',
  title: 'Supply houses: a house’s card opens on its bills, and each bill is marked paid by itself',
  kind: 'feature',
  highlights: [
    'Open a supply house on Materials and its bills come first. Up to four numbers lead: what is open, what is past due, what falls due next and what is not on a job account.',
    'The bills sit in groups by the day they fall due, each with its count and total. A bill is two lines that lead with the job, with the amount at the right edge.',
    'Each bill has its own Mark paid. The row stays where it is, greyed, with Mark unpaid beside it, and the page keeps your place.',
    'Dates read month and day, with a two-digit year only when it is not this year. Job accounts fold under the bills, and the app remembers how you left them.',
  ],
}

export default note
