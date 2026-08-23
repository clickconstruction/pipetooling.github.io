import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2119',
  date: '2026-08-23',
  title: 'Count Sheet strip: one tile for plan pages',
  kind: 'fix',
  highlights: [
    'The separate red "No plan page" tile is gone — the Plan pages cited tile now reads "1 (4 no pages)", with the missing-page count in red only when there is one.',
    'Same behavior as before: click the tile to see just the rows with no plan page, click again to show all.',
  ],
}

export default note
