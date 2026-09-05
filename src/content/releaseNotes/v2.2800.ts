import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2800',
  date: '2026-09-05',
  title: 'Robots: second-round backtests and a scoring door',
  kind: 'feature',
  highlights: [
    'A robot can now re-estimate a bid it already backtested in a fresh, blind round — the new run gets its own shell instead of the old one whose notes already hold the answer.',
    'Robot backtest scores land on the Scoreboard the moment the robot unseals, through a door that refuses to open the reference until the robot\'s blind total is on the record.',
    'A kickoff brief for the fresh-robot re-bid of Wendi\'s decided bids ships with the robot docs.',
  ],
}

export default note
