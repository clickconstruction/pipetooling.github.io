import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3006',
  date: '2026-09-07',
  title: 'Safety net under workflow step notifications',
  kind: 'fix',
  highlights: [
    'The emails and pushes sent when a workflow step is started, completed, approved, rejected or reopened now have 14 tests pinning who is notified, how each person is found, and exactly what is sent; no behaviour change.',
  ],
}

export default note
