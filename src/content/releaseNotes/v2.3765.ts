import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3765',
  date: '2026-09-23',
  title: 'Bill tab: the ⋯ menu on a bill opens where you can read it',
  kind: 'fix',
  highlights: [
    'On Edit Job → Bill, the ⋯ menu beside Record payment used to open toward the left edge of the window and lose its first words behind it — “ayment cash, check”, “ount credit note”. It now opens to the right of the button, so every item reads in full.',
    'On a narrow phone, where the button can sit near the right edge, the menu opens to the left instead; it picks whichever side has room each time it opens.',
  ],
}

export default note
