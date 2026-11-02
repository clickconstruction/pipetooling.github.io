import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6364',
  date: '2026-11-02',
  title: 'Search every file deeply: the index check says which files are in the index and which are not',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'After the one-time backfill the owner asked how we would know, later on, which uploaded files are in the index and which are not. A new check answers it: every file in the Shared Drive against every row of the index, in one call.',
    'It counts the files with no row (never reached by a walk or the sweep), the files changed in Drive since their row, the rows whose file is gone, and the rows with and without text by reason, and names the first files with no row so someone can act on them.',
    'A dev runs it from a terminal and reads one line, such as how many files have no row; the same door is open to the office in the app and changes nothing in Drive or in the index.',
  ],
}

export default note
