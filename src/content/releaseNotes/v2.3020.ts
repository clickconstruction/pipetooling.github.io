import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3020',
  date: '2026-09-07',
  title: 'Safety net under people tags',
  kind: 'fix',
  highlights: [
    'The tag catalog on People and the Users tab — tag names, who carries which tag, and usage counts — now has 9 tests pinning how tags are read, counted and replaced; no behaviour change.',
  ],
}

export default note
