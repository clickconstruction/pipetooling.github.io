import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5123',
  date: '2026-10-09',
  title: 'GC projects: a customer can pay a certified bill by card in their portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A certified bill on a GC job shows PAY BY CARD beside its check reference in the customer’s portal. It stays hidden until the owner turns it on.',
    'The customer sees the bill, the 3% card fee and what the card pays before they go to Stripe’s card page. The bill then takes cards only.',
    'Only the customer turns a bill to card. Make Stripe bill on Edit Job now refuses a GC bill and says why.',
    'A bill on card shows PAY ONLINE, and its line says the card fee it includes.',
  ],
}

export default note
