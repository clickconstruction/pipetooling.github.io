import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5106',
  date: '2026-10-09',
  title: 'GC Review: ask by link and the office week read through the app’s own types',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Nothing changes on screen. Asking an account man by link and the office’s statement week now go through the database’s generated types, so a renamed column fails the build instead of a Wednesday round.',
  ],
}

export default note
