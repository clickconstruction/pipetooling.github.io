import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3692',
  date: '2026-09-21',
  title: 'Cash or a check for a Stripe bill: record it on the bill, and the payment box never locks on you',
  kind: 'fix',
  highlights: [
    'Edit Job → Bill: every open bill now has a Record payment button (and the same entry under its ⋯ menu). It opens the Record a cash or check payment window for that bill with the open balance filled in. On a bill that went out through Stripe, Stripe marks the bill paid too, so the pay link stops working and no reminder goes out.',
    'The trap is gone: typing an amount on a hand-entered payment line used to attach the line to the job\'s only open bill, and when that bill was a Stripe bill the line turned read-only after the first digit — a $1 payment nobody meant, with no way to remove it. A hand-entered line no longer attaches itself to a Stripe bill, the bill chips and the Applies to list leave Stripe bills out, and the line stays editable.',
    'If you do type a payment on a job whose bill is a Stripe bill, an amber note under the line says so and offers Record on the bill — it carries the amount you typed into the window and drops the typed line once Stripe has recorded the payment. What you typed is kept, not retyped.',
    'The button under Payments received is now "+ Record a cash or check payment", and the ⓘ How payments update note says how Stripe bills record theirs.',
  ],
}

export default note
