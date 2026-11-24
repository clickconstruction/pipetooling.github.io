import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8448',
  date: '2026-11-24',
  title: 'Bills sent: By day paid opens where the money is',
  kind: 'fix',
  highlights: [
    'By day paid now opens this month on the newest day money came. Before, it opened on today, which each morning read Nothing came in with no press to take.',
    'Once money comes in today, the view opens on today again. Today keeps its ring, and its tile still counts it.',
    'An empty day’s press names where it goes, like Go to Mon, Nov 23. Before, Go to today could land on another empty day.',
    'In a month with no money yet, the press opens the month before.',
  ],
}

export default note
