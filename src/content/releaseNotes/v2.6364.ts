import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6364',
  date: '2026-11-02',
  title: 'Search every file deeply: the index check says which files are in the index and which are not',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'After the one-time backfill the owner asked how we would know, later on, which uploaded files are in the index and which are not. A new check answers it: every file in the Shared Drive against every row of the index, in one call.',
    'It counts the files with no row, the files changed in Drive since their row, and the rows with and without text by reason. A row for a file outside the Shared Drive is counted on its own and never called gone.',
    'A dev runs it from a terminal and reads the counts in plain sentences. A second mode then indexes the files with no row, one file a call, until none are left. Neither writes to Drive.',
  ],
}

export default note
