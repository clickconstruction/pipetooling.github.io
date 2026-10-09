import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5025',
  date: '2026-10-09',
  title: 'GC projects: the customer signs change orders and accepts the work in their portal',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A GC job’s customer sees it in their portal, with each change order waiting on them. The customer can sign it or decline it there.',
    'A decline can say why in one line, or say nothing. Change orders shows the reason.',
    'Once every line is billed, the customer can accept the work in their portal, with their name and a note.',
    'Change orders and Closeout say when an answer came in their portal.',
  ],
}

export default note
