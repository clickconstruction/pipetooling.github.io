import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7891',
  date: '2026-11-18',
  title: 'Trips: split a trip in two',
  kind: 'feature',
  highlights: [
    'Sometimes one trip is really two: the crew went home in the middle and came back. An open trip now has Split in two beside Change.',
    'Pick the day the second trip starts. The window shows both trips before you press Split into two trips.',
    'The first trip keeps its number. The second is a new trip with the next number, and each person goes where their days are.',
    'A trip on a bill keeps its line. No clock row, bill or cost changes.',
  ],
}

export default note
