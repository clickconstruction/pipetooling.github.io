import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2422',
  date: '2026-08-28',
  title: 'Alternates read like alternates',
  kind: 'feature',
  highlights: [
    'The letter\'s Alternates block now leads with Add / Deduct against the proposed amount ("Alternate 1 — PEX in lieu of copper: Deduct $16,500 ($198,400.00)"), says "no change" when prices match, and numbers each alternate.',
    'A price you offered on an alternate nests under it as an "— or" line instead of repeating the scope — and internal price names like "Default" never print: an option shows a name only when you\'ve given it one.',
    'Rename bids and price options right in the Cover Letter checklist with the new ✎ — the letter prints exactly the names you see.',
  ],
}

export default note
