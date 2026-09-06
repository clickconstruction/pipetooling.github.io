import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2903',
  date: '2026-09-05',
  title: 'Materials papercuts — real duplicates first, one meaning per "PO" tab, honest time-ago',
  kind: 'fix',
  highlights: [
    'Duplicate Materials now opens on parts that share a name (ignoring case and spacing). "Show near-matches" is opt-in and only pairs names whose sizes and numbers agree — a 1/2" fitting is never a "duplicate" of the 3/4" one.',
    'The three PO tabs each say what they are: PO Generator mints the counter code you read to the supply house; PO Builder and Purchase Orders are line-item material lists (and feed a bid\'s material estimate). The line-item tabs link straight to PO Generator.',
    'The green Parts Book button is now "Price coverage" (how much of each book has a price, per supply house) — "Supply Houses" is the tab. The Manufacturer filter shows one entry for WATTS / watts and matches both spellings.',
    'Time-ago labels read "4 weeks ago" for a 28–29-day gap instead of "0 months ago" (Supply Houses Updated / Paid and everywhere else). Job Tally draft POs are credited to whoever tallied them, not the job\'s master, and master technicians get the Dispatch Mode PO tab by default (dev still opts in under the gear).',
  ],
}

export default note
