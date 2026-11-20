import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8058',
  date: '2026-11-20',
  title: 'Job Budget: the card says dollars over or under, not points',
  kind: 'fix',
  highlights: [
    'The sentence on a job’s Budget card used to read labor is 9 points ahead of progress. It now says the dollars: labor is $4,233 over for the work done, or subs are $1,305 under for the work done.',
    'When a part of the job is named has not changed. It is still named when it passes its whole estimate, or when its spending is well ahead of or behind the work done.',
    'This was the last screen that said points. The Job pace card, the Projects board and the Costs tab stopped saying it earlier today.',
  ],
}

export default note
