import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3604',
  date: '2026-09-18',
  title: 'Supply houses: the summary table sorts by any column, Last Paid included',
  kind: 'feature',
  highlights: [
    'On Materials → Supply Houses, every header of the summary table is now a sort: Supply House, Outstanding, Due, Updated and — when the toggle shows it — Last Paid. Click once for the natural order (biggest owed first, newest first, names A to Z), again to flip.',
    'Houses with nothing in a column (no payment day, never paid) sit at the bottom either way, and the pick is remembered on your device.',
  ],
}

export default note
