import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4847',
  date: '2026-10-07',
  title: 'Bill tab: a check the app counts can be applied to the Stripe bill after the fact',
  kind: 'fix',
  highlights: [
    'A payment recorded on a job before its Stripe bill went out, or matched in Accounts Receivable, counted here but not in Stripe: the pay link and the invoice PDF still asked for the full amount.',
    'The payment’s ⋯ menu under the bill now has Apply it to the Stripe bill. Stripe gets the same credit line a part payment gets, and the pay link asks for the rest.',
    'The window says what the customer will read and what stays due. Undo part payment is the way back.',
    'A payment that covers the whole bill is a Mark Paid, not a credit line; the door says so.',
  ],
}

export default note
