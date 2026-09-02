import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2630',
  date: '2026-09-01',
  title: 'Supply house quotes: paste the reply, compare the prices',
  kind: 'feature',
  highlights: [
    'Bids → Pricing → ▾ menu → "Plug in a quote": paste the vendor\'s reply — text, email, phone notes, any shape — and it matches lines to your fixtures. Confirm the guesses, fix anything, save.',
    'A "Quotes (n)" chip appears by Share once a quote is saved. It opens the compare view: parts grouped by Division 22 section, one column per supply house, best price starred, expired quotes crossed out.',
    'Tap a price to pick it for that part — the picked total updates at today\'s counts.',
    'Every saved price feeds a per-house memory, so the next bid shows what that house last quoted for the same part name.',
  ],
}

export default note
