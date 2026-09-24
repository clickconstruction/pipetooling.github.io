import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3812',
  date: '2026-09-24',
  title: 'Clearing a Not coming in mark works again',
  kind: 'fix',
  highlights: [
    'On Schedule Dispatch, pressing Mark as coming in on a Not coming in or No call, no show chip failed with a "function does not exist" error, so a day off could not be undone when the person turned out to be coming in after all.',
    'The undo checked the caller against a permission helper that was retired in July. It now checks the same office and payroll roles the rest of the board uses.',
    'Nothing else changes: clearing the mark still only removes the day-off entry, and blocks removed when the day was marked off still need adding again from the cell.',
  ],
}

export default note
