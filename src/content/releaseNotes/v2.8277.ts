import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8277',
  date: '2026-11-21',
  title: 'In kind: Today’s sends holds a pay reminder on a job an arrangement pays',
  kind: 'fix',
  highlights: [
    'A pay reminder the app prepared before a job went on an in kind arrangement is now held on Today’s sends. Send all skips it.',
    'The row says why: an in kind arrangement pays the job’s bills. Not this one puts it away.',
    'A text a person wrote for the Paid step is left alone, and so is Remind now on the step’s card.',
  ],
}

export default note
