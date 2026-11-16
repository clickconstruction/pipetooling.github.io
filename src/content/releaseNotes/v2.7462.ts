import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7462',
  date: '2026-11-16',
  title: 'Supply houses: move a payment to the bill the house put it on, and put a removed payment back',
  kind: 'feature',
  highlights: [
    'When a supply house applies your money to a different bill, open the payment and press Move. Pick how much, the bill it goes to and why. A What changes panel shows both bills before and after.',
    'Both bills then say where the money went, with who moved it and why. A move is taken back from the payment\'s window.',
    'Money on account goes on a bill the same way, with Put on a bill.',
    'Removing a payment now asks why. A removed payment waits under the house\'s bills for 30 days, with Put it back.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
