import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3035',
  date: '2026-09-07',
  title: 'Safety net under the pictures-folder request',
  kind: 'fix',
  highlights: [
    'Asking Dispatch for a Customer Pictures folder now has 7 tests pinning what the request says, when a duplicate or an already-linked job is declined, and how an orphaned request is retired; no behaviour change.',
  ],
}

export default note
