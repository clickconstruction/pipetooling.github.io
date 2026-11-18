import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7690',
  date: '2026-11-17',
  title: 'Painted maps: closing an unsaved walk can keep it or throw it away',
  kind: 'feature',
  highlights: [
    'Close a painted map with a walk you have not saved, and the question now has three presses.',
    'Close, and keep the walk on this phone works as before. The walk stays for a day and the app offers it back.',
    'Close, and throw the walk away is new. It drops the walk at once, with no trip back to Look it over.',
    'Stay goes back to the map.',
  ],
}

export default note
