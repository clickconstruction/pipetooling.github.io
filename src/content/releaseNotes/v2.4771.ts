import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4771',
  date: '2026-10-07',
  title: 'Legal portal: the precinct',
  kind: 'feature',
  highlights: [
    'The Lien grid’s Court column and each matter’s Where to file now name the justice precinct once the office’s court map has placed the property, for the work’s address and the defendant’s. A property on a line between two precincts says so.',
    'A property record has a Justice precinct field. A typed precinct wins over the map and is never changed by it; the record says where its precinct came from.',
  ],
}

export default note
