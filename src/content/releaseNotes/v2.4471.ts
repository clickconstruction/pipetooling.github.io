import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4471',
  date: '2026-10-03',
  title: 'Customers: a job or a customer made in the evening keeps its day',
  kind: 'fix',
  highlights: [
    'When HouseCall Pro gave no day, filling in its payments or tips took the day the job was made. A job made after 7 pm Central got the next day. It now gets its own day.',
    'Customer since on a customer’s page and profile read the next month for a customer added on the last evening of a month.',
    'An estimate’s day on the customer snapshot and the last activity on the phone’s customer list read that next day too.',
  ],
}

export default note
