import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4919',
  date: '2026-10-08',
  title: 'GC mode: an invitation to quote skips a size the project has not got',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'An invitation to quote said the address followed by ". ." when the project had no size written down. It now says only what the project has, and leaves the line out when it has neither.',
  ],
}

export default note
