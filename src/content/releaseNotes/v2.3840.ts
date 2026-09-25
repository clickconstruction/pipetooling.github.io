import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3840',
  date: '2026-09-25',
  title: 'Calendar: the month arrows stay on the month you picked',
  kind: 'fix',
  highlights: [
    'Pressing the ← or → month arrows on the Calendar jumped straight back to the current month, so you could not page to next month or last month. The arrows now stay where you put them; Today still brings you back.',
    'The My Day card still carries the month with it: scrubbing My Day past the edge of the grid moves the month to follow.',
    'A time-off row in the Upcoming list now opens your Personal Time Off window in place, the same as the time-off chip on the calendar, instead of dropping you on the Settings page.',
  ],
}

export default note
