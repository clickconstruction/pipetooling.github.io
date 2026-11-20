import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8037',
  date: '2026-11-20',
  title: 'Checklist: Waiting For starts folded, as one row with its count',
  kind: 'feature',
  highlights: [
    'On Checklist → Today, Waiting For is now one folded row under your tasks. It was always open and could run longer than the day’s own work.',
    'The row says how many tasks wait and behind how many steps, like 5 tasks behind 2 steps, with a peek at the first step.',
    'Tap the row to open the whole list. Tap it again to fold it. It is folded each time you open the page, the same as on the Dashboard.',
  ],
}

export default note
