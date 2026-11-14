import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7256',
  date: '2026-11-14',
  title: 'Edge functions no longer upload the whole database types file',
  kind: 'infra',
  highlights: [
    'Nothing on a screen changes. Seventeen server functions carried a list of every table in the database when they were sent up, and the biggest was refused for its size.',
    'They now carry only the tables they read. The biggest is 3.86 MB where the limit is 5 MB, and the customer portal fell from 4.17 MB to 3.00 MB.',
    'A change that takes any function past 4 MB is now stopped before it merges, not at the send.',
  ],
}

export default note
