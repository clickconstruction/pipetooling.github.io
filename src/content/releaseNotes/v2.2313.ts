import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2313',
  date: '2026-08-25',
  title: 'Payment history on every customer invoice',
  kind: 'feature',
  highlights: [
    'Invoices now carry an HCP-style payment box — each payment\'s date, method, and amount, plus Total paid and a red Balance due (or "Paid in full") — on the screen preview, the PDF, and the invoice email.',
    'The customer portal shows the same thing: every open bill lists the payments already received on it, so customers can see their check landed without calling.',
    'Internal payment notes no longer print on customer paper — the method only.',
  ],
}

export default note
