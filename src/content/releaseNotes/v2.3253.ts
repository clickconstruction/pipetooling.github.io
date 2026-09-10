import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3253',
  date: '2026-09-10',
  title: 'Give a customer a discount from the line items',
  kind: 'feature',
  highlights: [
    "On a job's Bill tab, press − Add discount under ① Line Items. Type 10% for a percent or 500 for dollars — the other form shows beside it, and tapping it swaps. Chips fill in the reason: Negotiated, Referral, Repeat customer, Goodwill, Price match.",
    'A percent stays live as prices change, a dollar amount holds, and neither can exceed the work it applies to. The row says what it does in words — 10% off all 3 work lines · follows each draw — and on a multi-line job you can limit it to chosen lines.',
    'A discount follows the work: every draw that bills those lines carries its share as its own labeled line, and the ② Invoices strip, Still to bill and the Job Total already read the discounted figures. Once part of it is on a bill it locks.',
    "Help: give a customer a discount. Fixes: a change order's credit line applied to a job is now kept as a dollar discount instead of being dropped on the next save.",
  ],
}

export default note
