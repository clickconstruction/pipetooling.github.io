import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2595',
  date: '2026-09-01',
  title: 'Light mode gets its border lines back',
  kind: 'fix',
  highlights: [
    'A typo in the theme file had been silently deleting the standard light-mode border color since mid-July — table row separators, card outlines, and divider lines quietly vanished wherever it was used. They\'re back.',
    'Dark mode was never affected. If light mode suddenly looks a touch more "ruled" than yesterday, this is why — that\'s the intended design returning, not a new one.',
  ],
}

export default note
