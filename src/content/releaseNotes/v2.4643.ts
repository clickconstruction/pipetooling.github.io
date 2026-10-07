import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4643',
  date: '2026-10-05',
  title: 'Legal: give the law firm settlement authority with a floor',
  kind: 'feature',
  highlights: [
    'On the Legal desk, set a settlement floor for a matter, in dollars or a percent of the balance. You can also set it when you mark the account attorney-ready.',
    'The firm sees the floor on its portal and settles at or above it on its own.',
    'A settlement below the floor comes to your Needs You card as a settlement ask. Sign off settles the matter; Not yet sends your note back.',
  ],
}

export default note
