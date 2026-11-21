import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8122',
  date: '2026-11-20',
  title: 'Job pace: the card shows your next stop when you are clocked in with no job',
  kind: 'fix',
  highlights: [
    'A superintendent who clocked in with no job linked, or onto a bid, lost the Job pace card for the whole of that clock, with the day’s first stop still ahead.',
    'The card now shows for the next stop on the day. One line says whose pace it is: Next stop, with the job’s number and name.',
    'Once you clock onto a job, the card is that job’s again, as before.',
  ],
}

export default note
