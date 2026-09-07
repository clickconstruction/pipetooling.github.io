import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3028',
  date: '2026-09-07',
  title: 'Safety net under Form Studio saves',
  kind: 'fix',
  highlights: [
    'Creating, revising, deleting and publishing a form in Form Studio now has 12 tests pinning where the PDF is stored, what the template row holds, and how publishing places its Book entry; no behaviour change.',
  ],
}

export default note
