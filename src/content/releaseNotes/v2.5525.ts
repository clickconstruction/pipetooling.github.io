import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5525',
  date: '2026-10-14',
  title: 'Job Mode: Message the customer reads their own thread',
  kind: 'fix',
  roles: ['dev', 'primary', 'helpers'],
  highlights: [
    'When a customer has more than one contact, Message the customer now shows the answer from their own thread. A person named at the customer, like a tenant, no longer stands in for them.',
    'A note from Something else shows in Job updates right away. You no longer reload the page to see it.',
  ],
}

export default note
