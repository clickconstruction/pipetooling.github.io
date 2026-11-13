import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7078',
  date: '2026-11-12',
  title: 'Materials: what a site’s material is worth, and a name tied to the parts book',
  kind: 'feature',
  highlights: [
    'A site’s materials screen has a new figure, Worth. It reads what is known and how much of the site has a price, such as 9 of 118 lines. It never shows a total without that.',
    'Press Worth to list the rows with no price, most pieces first.',
    'On an open row, This is a parts-book part ties a typed name to a part in the parts book. The row then reads the book’s name and price, and Worth grows.',
    'A tie can be undone, and it never changes a count or a box.',
  ],
}

export default note
