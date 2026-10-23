import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5767',
  date: '2026-10-23',
  title: 'Customers: a row that breathes, and how fast they pay',
  kind: 'feature',
  highlights: [
    'Each customer’s row reads in two lines, like the name and address beside it: what they have (projects, bids, open jobs, notes), then where the money stands (what they owe, the last touch).',
    'The money line ends with how long they take to pay after a bill, pays in ~30d or pays in 9–41d, in the quietest type on the row, from the same figure the Pipeline’s expected pay dates use. A customer with no history says nothing.',
  ],
}

export default note
