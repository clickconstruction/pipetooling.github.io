import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3017',
  date: '2026-09-07',
  title: 'Safety net under My Time segment saves',
  kind: 'fix',
  highlights: [
    'Saving an edited My Time day before assigning its segments now has 7 tests pinning which of the four save paths each shape of edit takes and that every segment gets its own session; no behaviour change.',
  ],
}

export default note
