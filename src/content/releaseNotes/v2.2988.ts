import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2988',
  date: '2026-09-07',
  title: 'Takeoffs: the materials total respects bid versions, and Enter in a dialog no longer jumps fixtures',
  kind: 'fix',
  highlights: [
    'On a bid with more than one version, the Materials summary at the bottom of Takeoffs (and the cost estimate printed from Labor) added the other version\'s part lines on top of the active one. It now counts only the version you are looking at — the same number the strip, the cost rail and Pricing already showed.',
    'In One at a time, pressing Enter to confirm "Remove this line?" (or with any button focused) used to move to the next fixture instead. Enter now does what the focused button or dialog says; Done still answers Enter when nothing else is in focus.',
  ],
}

export default note
