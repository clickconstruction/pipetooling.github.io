import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7972',
  date: '2026-11-19',
  title: 'Send Email invoice: the window never names the customer on a bill that went to the GC',
  kind: 'fix',
  highlights: [
    'On a Stripe bill that went to the GC, the window before Send Email invoice and Never got it? Resend named the job\'s customer\'s address. The email went to the GC all the same.',
    'The window now reads that the bill email goes to the GC, at the address on the Stripe invoice.',
    'A bill typed to someone else names that person\'s address. A customer\'s bill reads as before.',
    'After the send, the green line still names the exact address it went to.',
  ],
}

export default note
