import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3255',
  date: '2026-09-10',
  title: 'The discount prints on every bill',
  kind: 'feature',
  highlights: [
    'A discount now shows on the customer’s bill as its own line — Negotiated discount (10%) −$1,509.80 — on Stripe bills, on the physical PDF and its email, and in the Bill Customer previews.',
    'It follows the work: each draw that bills a discounted line carries that line’s share, and the draws together always add up to the whole discount to the cent.',
    'The auto remainder bill and the Stripe and PDF previews all read the job after the discount, so a discounted job bills the right amount without a second thought.',
  ],
}

export default note
