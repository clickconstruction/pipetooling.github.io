import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4801',
  date: '2026-10-07',
  title: 'A check on a Stripe bill waits to clear before Stripe hears about it',
  kind: 'feature',
  highlights: [
    'Mark Paid · Check on a Stripe bill now records the payment in the app only. The bill reads Paid here at once; the Stripe invoice stays open until the check has had its seven days to clear, then closes on its own each morning.',
    'Until then the check is an ordinary payment: Move to job… carries it to the right job in one press, Remove takes it off, and the bill reads Billed again. No credit note, no send-back, no fresh invoice number for the customer.',
    'Cash, wires, bank transfers and cards close in Stripe at once, as before. A check the bank returns inside the week is never closed by the sweep.',
    'Mark Paid says what will happen under the payment type, and the payment line on the Bill tab names the day Stripe closes.',
  ],
}

export default note
