import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2849',
  date: '2026-09-05',
  title: 'Robots: counts land in one call, and a bid with no rows cannot be scored',
  kind: 'fix',
  highlights: [
    'A robot can now paste its counts and book prices into the bid in one step, and the server refuses the paste unless the rows add up to exactly the total the robot committed to.',
    'Scoring a backtest now requires the counts to be in the bid first — the "draft $0" audit cards that sat unjudgeable for four days can no longer happen.',
  ],
}

export default note
