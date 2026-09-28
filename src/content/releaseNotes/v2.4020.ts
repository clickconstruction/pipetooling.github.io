import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4020',
  date: '2026-09-28',
  title: 'The bill email comes from us, with a QR code and a short address to the customer’s statement',
  kind: 'feature',
  highlights: [
    'Send Email invoice on a Stripe bill now sends our own email instead of Stripe’s: the amount and due date, a Pay now button, the invoice PDF attached, and "Your account, any time" with a QR code and the short address of their statement. Paying still happens on Stripe’s page. If our email cannot go out, Stripe sends its own, so a bill is never left unsent.',
    'A customer who has a portal but no short address is given one the first time a bill points at it — their name plus a random tail, like my.clickplumbing.com/hartwell-homes-k7x2 — so invoices stop printing the 64-character link. You can still change it from the globe. A customer with no portal, or one that was turned off, gets no address and no code.',
    'Pay now opens the bill’s own address (clicktooling.com/pay/…), which keeps working after Stripe’s link expires. A bill addressed to someone else (Bill-to) never carries the customer’s statement.',
    'A test-mode bill comes to whoever pressed Send, marked as a test, and never to the customer. Settings → What customers see now shows the bill email itself, where it used to say Stripe sends it.',
  ],
}

export default note
