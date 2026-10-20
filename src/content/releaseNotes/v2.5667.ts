import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5667',
  date: '2026-10-20',
  title: 'The Directory stops repeating "Supply house" down a column',
  kind: 'fix',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'The office\'s Directory on Materials → Supply houses dropped its Kind column, which said "Supply house" on most rows — wrapped into a two-line oval.',
    'A vendor the office only pays — an insurer, a rental yard, the sub ledger — now carries a small chip beside its name instead. Hover it for what the kind means.',
    'A "Ledger only" band marks where those vendors start, the way the "Needs a rep" band already marks houses missing a rep. The freed width went to the Reps column.',
    'The Phone column reads one way — (210) 344-4950 — however the number was typed; a number that is not a plain US one stays as typed. The All kinds filter, the vendor form and the estimator\'s tab are unchanged.',
  ],
}

export default note
