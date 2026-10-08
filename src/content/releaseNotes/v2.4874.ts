import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4874',
  date: '2026-10-07',
  title: 'Uncollectible: a bill the office gave up on stops counting in the last few places',
  kind: 'fix',
  highlights: [
    'The Pipeline map pins a given-up job but counts nothing to collect for it, and it leaves the list of jobs to ask for money.',
    'The Dashboard\'s Billed pin, the contract sweep and the dev\'s count of Collections accounts awaiting review leave given-up jobs out.',
    'A given-up row no longer shows an expected pay date, and searching for one no longer says "No match anywhere".',
    'The accountant\'s list prints one dollar sign per amount.',
  ],
}

export default note
