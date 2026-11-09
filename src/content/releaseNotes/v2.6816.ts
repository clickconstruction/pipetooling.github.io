import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6816',
  date: '2026-11-09',
  title: 'In kind: a payment that pays a bill down but is not money',
  kind: 'feature',
  highlights: [
    'Wherever you pick a payment\'s kind — the Record a cash or check payment window and the Type box on an Edit Job payment line — there is now In kind, beside Cash, Check, Wire, ACH and Card. Pick it for a credit given instead of money, such as a customer who is also the landlord taking finished work off the rent, and say what was given in the memo: "Rent credit, March 2026". The window will not record an in-kind payment without the memo.',
    'An in-kind payment pays its bill down, moves the job to Paid when the balance reaches zero and counts toward the customer\'s totals exactly as any payment does. It is never counted as money that landed, money at the bank or a check in the drawer on the Dashboard\'s money-in week, and it never sits on the deposit-matching list in Accounts Receivable waiting for a deposit that will not come.',
    'On a bill that went out through Stripe it takes the same two paths a cash payment takes: under the open balance Stripe puts a credit line on the invoice that reads "Credit applied Mar 3 · $1,000.00" so the pay link asks for the rest; at the balance the invoice is marked settled outside Stripe and the pay link stops working. Nothing claims cash arrived.',
    'On the customer\'s statement, the printed invoice and the portal an in-kind payment reads Credit, never cash.',
  ],
}

export default note
