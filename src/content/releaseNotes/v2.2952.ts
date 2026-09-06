import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2952',
  date: '2026-09-06',
  title: 'Robots: holdout bids refuse to be practiced on',
  kind: 'infra',
  highlights: [
    'A reference marked holdout now refuses to open as robot practice at the server — it exists to measure whether the robots generalize, and practicing on the measuring stick would fake the grade.',
    'Only an operator-ordered gate run can open one, and the dispatcher quietly skips them when handing out work.',
  ],
}

export default note
