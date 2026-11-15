import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7293',
  date: '2026-11-15',
  title: 'The dev seat stops carrying the database table list',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. Nine of the dev seat’s kernels named a database table’s row type, and each such name pulled the whole list of tables the kernels know into what is sent up.',
    'The copy of the kernels now writes each row type out where it is named and carries a 7 KB file of the enums instead. The dev seat is sent up at 3.42 MB where it was 3.72 MB, and 4.03 MB two days ago.',
  ],
}

export default note
