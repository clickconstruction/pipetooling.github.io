import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2469',
  date: '2026-08-28',
  title: 'The auto remainder bill lists the stages it actually covers',
  kind: 'fix',
  highlights: [
    'The draft tagged "auto" is the bill for whatever stages you have not split onto their own invoices. Sending it used to produce a bill listing every line item on the job, scaled down — including stages already billed elsewhere.',
    'Now, when the not-yet-invoiced stages add up exactly to the auto bill\'s amount, the customer sees those stages by name at their real prices — on the Stripe bill, the preview, and the printed invoice alike.',
    'If a payment or a hand-typed dollar bill has taken a bite out of a stage, there is no honest way to name the pieces — those bills keep the old proportional breakdown.',
  ],
}

export default note
