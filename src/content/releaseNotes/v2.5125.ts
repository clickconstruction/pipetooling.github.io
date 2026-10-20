import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5125',
  date: '2026-10-09',
  title: 'GC projects: Bill the customer reads a bill on card, and the owner turns Pay by card on in Settings',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'The owner turns Pay by card on or off for GC customers in Settings, under Jobs & billing. It starts off.',
    'Bill the customer shows a bill on card with what Stripe asks, its card page, and the day it was paid. Every figure still reads what the architect certified.',
    'Back to a check bill takes the card page down and the 3% fee off, while nothing is paid on it.',
    'Our certified bill and reminder emails offer the card in the customer’s portal when it is on. A reminder on a card bill says where to pay.',
  ],
}

export default note
