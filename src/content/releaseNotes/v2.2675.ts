import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2675',
  date: '2026-09-03',
  title: 'Overhead — who makes it up, by person',
  kind: 'feature',
  highlights: [
    'People → Overhead has a new "Who makes up overhead" table: one row per person, columns for office labor, bid labor, office parts, and total — every cell shows the dollars and that person’s share of the column.',
    'Switch the window with one tap: Today, Last 7 days, Last 30 days, or Last 90 days — no reload, the numbers re-slice instantly.',
    'Card purchases land on the cardholder; supply invoices and bank transfers that have no person sit on an explicit last row, so the columns always add up to the pool.',
  ],
}

export default note
