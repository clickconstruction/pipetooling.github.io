import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7450',
  date: '2026-11-16',
  title: 'Supply houses: a payment becomes a record of its own (the ground)',
  kind: 'infra',
  highlights: [
    'A payment to a supply house can now be stored as its own record: the day, the amount sent, how it was sent and which bills it paid. Nothing on screen changes yet; the Record a payment window comes next.',
    'A bill reads paid when its payments cover it, so every screen that shows paid and unpaid bills keeps reading the same.',
    'Every bill already marked paid got one payment "from before", for its whole amount on the day it was marked paid.',
    'Mark paid and Mark unpaid work as before. Behind the press, Mark paid now makes a payment for what the bill still owes.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
