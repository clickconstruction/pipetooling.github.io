import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7455',
  date: '2026-11-16',
  title: 'Supply houses: Record a payment, with the day, the amount, how it was sent and its number',
  kind: 'feature',
  highlights: [
    'Record a payment takes the place of Make Payment on a supply house. Tick the bills a payment covered and the amount adds itself, or type the amount and the oldest bills fill first.',
    'Say how it was sent with a chip: Card, ACH, Check, Cash or Other, with its confirmation or check number. The chips open on how that house was paid last. Say later records it now and leaves the method for later.',
    'One press ticks everything due by the house\'s pay day. The green button names what it records, like "Record $5,000.00 on 4 bills".',
    'A paid bill names its payment on its row. See the payment opens it with every bill it paid, and a payment recorded by mistake is removed there.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
