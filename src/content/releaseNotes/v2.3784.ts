import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3784',
  date: '2026-09-23',
  title: 'A bounced check on a Stripe bill can be taken off the job',
  kind: 'fix',
  highlights: [
    'A check deposit matched to a Stripe bill in Accounts Receivable, then returned by the bank, had no way off the job: Unlink and remove refused every payment on a Stripe bill, Undo part payment needed a credit note the row never had, and Unwind needed a bill marked paid in Stripe. Stripe had never heard of the money — the bill was still open for its full amount — so the office was stuck with a paid figure the bank had already reversed.',
    'Now a payment on a Stripe bill is refused only while Stripe actually holds it: a part payment recorded as a credit note (Undo part payment is its door) or a bill marked paid in Stripe (Unwind is). A plain bank deposit unlinks like on any other bill, and the confirm says the pay link is untouched.',
    'The row says what the bank said — Returned by the bank · Insufficient funds — and removing that payment marks the deposit returned in Accounts Receivable in the same step, so it never lands in To match again. Every removal is now on the job’s payment record, with who did it and why.',
    'Fixes Take 5 – Seguin (2026-09-23): the $13,680 check the GC’s bank returned comes off the job, the balance reads $38,625 open again, and the lien notice claims all of it.',
  ],
}

export default note
