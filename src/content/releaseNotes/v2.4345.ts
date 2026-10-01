import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4345',
  date: '2026-10-01',
  title: 'Merge users works again',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Merging two accounts, and its preview, had stopped with an error about a table that no longer exists. Both work again.',
    'Nothing else about merging changes. The same rules decide which accounts can merge.',
  ],
}

export default note
