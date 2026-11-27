import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8738',
  date: '2026-11-27',
  title: 'Add a part on a small phone: the +10, +25 and +100 chips show above the keyboard',
  kind: 'fix',
  highlights: [
    'On a small phone, with the number pad up, the three chips under the number were hidden. You had to scroll to reach them.',
    'The sheet now uses all the room above the keyboard and trims its spacing. The number, the chips and the blue Add button all show at once.',
    'Under the blue button the sheet now runs down to the keyboard, where a strip of the page used to show.',
    'With the keyboard away, and at a desk, the sheet looks as it did.',
  ],
}

export default note
