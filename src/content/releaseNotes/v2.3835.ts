import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3835',
  date: '2026-09-25',
  title: 'Robot backtests: the score only unseals after a real lock',
  kind: 'fix',
  highlights: [
    'A robot scoring a backtest must first put its blind total on the bid’s notes as a LOCK line. The check only looked for the letters “lock”, so a note saying “blocked on plans” was enough to open the human number early. It now needs the word LOCK itself.',
    'A robot reusing another run’s name when scoring used to get that other run’s result back, human number included, and could change its verdict. That name is now refused and the robot is asked for a new one.',
  ],
}

export default note
