import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5798',
  date: '2026-10-23',
  title: 'Messages: the sort card asks who the sender is, by name and address or number',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'The card above a thread for a number or an address nobody has named now asks about the sender by name. An email reads Who is Dale Ferris, dale@ridgeway.example? A text with no name reads Who is 512-555-0142? A text that says who wrote it reads Who is Kevin Alvarez, 210-555-0188?',
    'The Who is this? pill on the New row and the button under the name in the thread header keep their short words, since the name sits beside them.',
  ],
}

export default note
