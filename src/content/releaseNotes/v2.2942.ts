import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2942',
  date: '2026-09-06',
  title: 'Robots: a holdout set keeps the scoreboard honest',
  kind: 'feature',
  highlights: [
    'Some past bids can now be held out as a private exam for the robots — they are never used for practice, so passing on them proves real skill, not memorization.',
    'The robot Queue marks held-out references with a HOLDOUT badge, keeps them out of practice prompts, and counts progress toward the 20–25 reference target.',
    'Scoreboard axis cards now say "no holdout evidence yet" when a passing streak was built entirely on practiced bids.',
  ],
}

export default note
