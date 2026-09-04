import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2772',
  date: '2026-09-04',
  title: 'Estimate accept page reads well on a phone',
  kind: 'feature',
  highlights: [
    'On phones each line item is its own block — name, description, then quantity × price and the amount — instead of a squeezed three-column table.',
    'The total and an Approve button sit right under the title, and a bar at the bottom of the screen keeps Accept in reach while the customer reads.',
    'The photo banner shrinks to a thin strip on phones so the estimate itself is on the first screen; desktop is unchanged.',
  ],
}

export default note
