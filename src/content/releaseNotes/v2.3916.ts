import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3916',
  date: '2026-09-27',
  title: 'Workflow: line-item links and dates use the same code as the Forecast',
  kind: 'fix',
  highlights: [
    'The Workflow page carried its own copy of two small rules — how a line item’s link is tidied before it opens, and how its date is printed. It now uses the tested ones the Forecast already had, so the two screens cannot drift apart.',
    'Nothing on screen changes; every link and date reads as before.',
  ],
}

export default note
