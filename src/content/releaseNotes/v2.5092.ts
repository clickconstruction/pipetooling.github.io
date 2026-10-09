import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5092',
  date: '2026-10-09',
  title: 'Lien emails: a reply reaches the office',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A reply to a lien email now goes to office@clickplumbing.com. That covers the GC’s courtesy PDF, a notice sent by email and the final demand letter. Before, these came from a no-reply address, so an answer reached no one.',
    'The courtesy email’s preview shows the same line, Replies to office@clickplumbing.com.',
  ],
}

export default note
