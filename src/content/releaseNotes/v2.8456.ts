import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8456',
  date: '2026-11-24',
  title: 'Document builder: the Sub NDA’s card of changed pages counts them, and the map outlines the open page',
  kind: 'feature',
  highlights: [
    'Under the Sub NDA’s map, the card now says how many pages changed, like 2 pages changed since revision 2.',
    'Two marks under the count show how words look on the right side: as published, and changed but not published.',
    'Each changed page shows its level beside its name, and the row for the page you have open is marked.',
    'On the map, the cell for the page open on the right has an outline in its level’s colour. It follows Next, Back and the slider.',
  ],
}

export default note
