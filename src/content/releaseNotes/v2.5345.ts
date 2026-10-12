import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5345',
  date: '2026-10-12',
  title: 'GC mode: our contract’s Paper waits for the customer’s portal',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Our contract’s send no longer offers Paper until the customer’s portal can show and sign a contract built from our clauses.',
    'A statement of work’s Paper is unchanged.',
  ],
}

export default note
