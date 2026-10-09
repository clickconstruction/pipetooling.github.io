import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5000',
  date: '2026-10-08',
  title: 'GC projects: remind the customer to pay a late GC bill',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'A late bill in Bill the customer shows Remind them to pay.',
    'Pick the pay-by day, five days out to start, and add a line of your own. You read the email before it goes.',
    'The customer replies with the day they will pay. Their portal link comes too when they have one.',
    'The bill says when you reminded them, and a note goes on the customer in the Payment Chase queue.',
  ],
}

export default note
