import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3383',
  date: '2026-09-13',
  title: 'Accounts Receivable: the bill picker reads like a list, not a sentence',
  kind: 'feature',
  highlights: [
    'Each open bill is two lines — the amount in its own column, then the job number and name, then who pays · the address · which line — with the Stripe tag on the right. No more four-line wrapped entries with the job number twice.',
    'The list opens as wide as the allocation row and as tall as the modal allows, so you see eight or more bills instead of one.',
    'The order follows the deposit: the matched payer’s bills first (the one equal to the deposit on top, tinted green with “✓ matches this deposit”), then other bills equal to the deposit, then everything else.',
    'The search field says what it matches — name, job #, address or amount — and a footer under the list counts the open bills and what they add up to. After a pick, the closed control reads “$250.00 · 1015 · Montolongo Post Test”.',
  ],
}

export default note
