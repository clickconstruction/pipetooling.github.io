import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2673',
  date: '2026-09-03',
  title: 'Overhead pool — trend and what it’s made of',
  kind: 'feature',
  highlights: [
    'People → Overhead now has an "Overhead pool — 90 days" card with a plain verdict: trending up, trending down, or flat, comparing the last 30 days against the 30 before.',
    'A composition ledger shows how much of the pool is office labor, bid labor, and office parts — dollars and share — instead of one blended total.',
    'A day-by-day chart stacked by those three parts, with a 7-day average line; hover any day for its split.',
  ],
}

export default note
