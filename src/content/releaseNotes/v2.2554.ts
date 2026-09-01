import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2554',
  date: '2026-08-31',
  title: 'Robot estimates now grade themselves line by line',
  kind: 'infra',
  highlights: [
    'When a robot practice-estimate is compared against the real one, a new tool automatically checks fixture counts, pipe footage per system, and — critically — whether both estimates were even looking at the same plan set.',
    'The same-plans check would have caught, automatically, a practice run this week that was accidentally graded against the wrong drawing package.',
  ],
}

export default note
