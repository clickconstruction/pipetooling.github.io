import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3754',
  date: '2026-09-23',
  title: 'A bill has an address that never expires: clicktooling.com/pay/…',
  kind: 'feature',
  highlights: [
    'Every Stripe bill can now be opened at clicktooling.com/pay/<bill id>. The page names the bill and the job, shows what is still owed, and forwards to Stripe’s secure payment page a second later — with a Pay now button in case it does not.',
    'Stripe’s own payment link expires 30 days after the due date; this address does not. It fetches Stripe’s current link every time it is opened, so a code or link printed on paper still pays months later.',
    'A bill that is already paid says Paid and the day it was paid, instead of asking again. A bill that was voided, or an address that is not a bill, says so and gives the office number.',
    'Settings → What customers see gains the page as Pay code, after Bill by email, with a sample you can open. Otherwise this is the groundwork for the pay codes on lien notices and the QR code in View bill (punch list #35); nothing else in the app changes yet.',
  ],
}

export default note
