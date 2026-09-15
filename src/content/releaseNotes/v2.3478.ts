import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3478',
  date: '2026-09-15',
  title: 'The Bill tab lists every bill, three lines each, and adds up',
  kind: 'feature',
  highlights: [
    'Job window → Bill → Invoices: paid bills stay in the list now, so it adds up to the Paid · Billed tiles above it — a sum line under the list says paid · open · = billed.',
    'Every bill reads the same way: the chip and amount, then who it went to and when ("sent Sep 4 to RMC-Dudley Mason"), then the money — "$9,800 open · 21 d past expected · They said Sep 19" on an open bill, "$8,000 paid · Jun 4 · 22 days" on a paid one. Nothing truncates.',
    'The button fits the bill: Send bill… on a draft; Text · Copy link · Email for chasing an open Stripe bill (Email dims until the job has a customer email); View on a paid one. Discounts, Make Stripe bill, See in Pipeline, who else sees the bill, the memo & footer, Delete draft and Send back all live under the row\'s ⋯.',
    'On a phone the list no longer scrolls sideways — the chase buttons drop under the words as one thumb-sized row.',
  ],
}

export default note
