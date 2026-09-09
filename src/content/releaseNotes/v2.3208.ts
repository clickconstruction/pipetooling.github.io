import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3208',
  date: '2026-09-09',
  title: 'Bids on a map: press Play to see the sections one at a time',
  kind: 'feature',
  highlights: [
    'A Play button next to the map title walks through the sections on its own: Unsent alone for two seconds, then Pending, Won, Started and Lost, around and around. The chip for the section on screen fills with its color.',
    'Pause holds whatever view is showing. Clicking a chip while it plays pauses it too.',
    'Sections with no pins are skipped, and Play only appears when at least two sections have something to show.',
  ],
}

export default note
