import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6008',
  date: '2026-10-28',
  title: 'A Bridge date more than a year out shows its year',
  kind: 'fix',
  highlights: [
    'The Bridge dial says when a pile is gone, or when the field runs out of work, as a month and a day. When that day is more than about eleven months away it now carries its year too, as in Jun 4, 2028, so a date nineteen months off no longer reads as next June.',
    'The same line in the Monday sheet and its email names the year the same way. A nearer day keeps its month and day, even across New Year.',
  ],
}

export default note
