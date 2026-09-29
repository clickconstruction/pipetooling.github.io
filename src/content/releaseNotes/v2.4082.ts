import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4082',
  date: '2026-09-28',
  title: 'A check that never cleared on a Stripe bill: send the bill back and bill again',
  kind: 'fix',
  highlights: [
    'A Stripe bill marked paid by check through Mark Paid is closed in Stripe as paid "out of band" — Stripe holds no money, only our mark. When the check then fails to deposit, the office had no way out: Void Stripe invoice refused because Stripe said paid, Undo out-of-band payment vanished once the payment row was gone, and Bill Customer said nothing was left to bill. The customer could not pay again because Stripe never reopens a paid invoice.',
    'Now View bill on such a bill offers Check didn’t clear · send back… — ClickTooling issues a credit note in Stripe that reverses the mark, removes the billed line and moves the job back to Ready to Bill, so Bill Customer sends a fresh invoice with a new pay link. The old invoice stays in Stripe as paid and reversed. A bill paid by card or bank transfer through Stripe still says to refund it in the Stripe Dashboard.',
    'Undo out-of-band payment ends the same way: a ticked-by-default box sends the bill back after the undo, since the old pay link can never be used again. Untick it to leave the bill Billed.',
    'On the job’s ③ Payments received, a check payment Stripe holds as that mark now wears Check didn’t clear… instead of nothing — it opens the undo with the reason filled in and the send-back on. Every reversal lands on the job’s payment record with who did it and why. Fixes Iannotti PRV (J1040, 2026-09-28).',
  ],
}

export default note
