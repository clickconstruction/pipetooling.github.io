import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2030',
  date: '2026-08-21',
  title: 'One loss-reason system — no more entering it twice',
  kind: 'feature',
  highlights: [
    'Edit Bid now has the same six why-we-lost chips as the Followup lens. Pick one when you mark a bid Lost and it never lands in the "need a reason" queue — the text box is just "what they said (optional)".',
    'Bids you already explained in words come pre-suggested in the Why we lost lens: your note lights up the matching chip and Enter confirms it — "gc not awarded" suggests GC lost the project.',
    'Suggestions are never applied without your tap, and an ambiguous note suggests nothing.',
    'The Workbench\'s "lost on price" calibration now counts reasons tapped anywhere, not just notes containing the word "price".',
  ],
}

export default note
