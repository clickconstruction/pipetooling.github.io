import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4751',
  date: '2026-10-07',
  title: 'Legal portal: Homestead on one line',
  kind: 'fix',
  highlights: [
    'On the Lien grid, Homestead and No homestead under Residential are now smaller text on one line.',
    'A rail entry with no job in view is left off, the No GC one included. If the one you chose empties when you switch the view, the grid goes back to All GCs.',
  ],
}

export default note
