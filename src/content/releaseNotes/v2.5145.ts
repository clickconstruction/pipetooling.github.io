import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5145',
  date: '2026-10-10',
  title: 'Contracts: asking for an agreement’s link no longer counts as sending it again',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When an agreement is already out and its link is good for more than a week, asking for the link hands out that link and changes nothing on the agreement.',
    'An agreement emailed as a PDF to sign stays that way, its send count and its reminders stay, and File the signed copy still turns it into the signed record.',
    'A draft, or a link with a week or less left, is sent and renewed as before.',
  ],
}

export default note
