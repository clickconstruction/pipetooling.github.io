import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2324',
  date: '2026-08-26',
  title: 'Invoices carry the payment ledger',
  kind: 'feature',
  highlights: [
    'The payment history on invoices now reads like the portal: Billed opens the box, each payment subtracts in green by the date received ("Paid Jul 17, 2026"), and Balance due closes it.',
    'The same box everywhere a customer looks: the invoice email, the on-screen preview, and the PDF.',
    'Generic method labels are gone; real ones, like a check number, still show. Weekdays dropped from payment dates to match the portal.',
  ],
}

export default note
