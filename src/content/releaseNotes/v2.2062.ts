import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2062',
  date: '2026-08-21',
  kind: 'fix',
  title: 'Pipeline activity box reads like a chat',
  highlights: [
    'The job activity box now reads top-down like a conversation — oldest note first, newest at the bottom — and keeps itself scrolled to the latest.',
    'Entry numbers are unchanged stable references (1 is still the oldest), and the floating button now reads "+ Add".',
  ],
}

export default note
