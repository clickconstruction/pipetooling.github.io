import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2168',
  date: '2026-08-23',
  title: 'People → Payroll: a Ledger view — what we owe each person',
  kind: 'feature',
  highlights: [
    'Payroll now has two views (dev only to start): Pay reports, the table you know, and Ledger — one money story per person with a running balance.',
    'The Ledger roster ranks everyone by what we owe them / what they owe us, with company totals and a one-line "why" under each name (unpaid reports, charges, credits).',
    'Pick a person: a signed balance with the words under it, the equation behind it, an amber note for unpaid reports, and one dated table of labor, payouts, back-charges, damage and credits — newest first — with drill-ins to the report or the offset editor.',
  ],
}

export default note
