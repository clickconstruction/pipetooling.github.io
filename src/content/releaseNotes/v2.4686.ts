import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4686',
  date: '2026-10-06',
  title: 'Database setup helpers are closed to outside calls',
  kind: 'fix',
  highlights: [
    'Three helpers the database runs when a table is added could also be called by anyone holding the app’s public key.',
    'Only database updates can run them now. Nothing changes on your screen.',
  ],
}

export default note
