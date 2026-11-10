import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6848',
  date: '2026-11-10',
  title: 'A job says when its customer pays in kind, and Bill Customer asks how the bill is paid',
  kind: 'feature',
  highlights: [
    'The job window shows an In kind chip beside the customer’s name when that customer pays in kind.',
    'A job that is not on the arrangement says so in a strip. One press, Put it on the arrangement, adds it.',
    'Bill Customer asks once how the bill is paid: in kind on the arrangement, or with money. Nothing is picked for you.',
    'In kind puts the job on the arrangement and records the bill. Nothing is sent to the customer. A job already on the arrangement skips the question.',
  ],
}

export default note
