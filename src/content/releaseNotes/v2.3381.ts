import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3381',
  date: '2026-09-13',
  title: 'Accounts Receivable: the bills that could match a deposit read as a list, not chips',
  kind: 'feature',
  highlights: [
    'Who paid you now sits above the allocations: the matched customer’s open bills one per line — amount · job · where · a Stripe tag when it applies — with the bill that equals the deposit tinted green and first, and any amount-only matches from other customers under their own heading.',
    'A tap on a row fills the first empty allocation line, or adds a line when every line is taken, so a check that covers two bills is two taps. The “2 bills = $4,091.50” suggestion is one row that fills both.',
    'Bills already on a line drop out of the list, so what is left to pick is what is shown.',
  ],
}

export default note
