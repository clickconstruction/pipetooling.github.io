import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1929',
  date: '2026-08-20',
  title: 'Waiting on Customers card opens "Who owes what"',
  kind: 'feature',
  highlights: [
    'Clicking the WAITING ON CUSTOMERS card on the Pipeline money view now opens a per-customer breakdown: every customer with open bills, sorted by total owed, with bill count and an oldest-bill age chip (amber 30+, red 90+).',
    'Click a customer to see their individual bills — oldest first — and View jumps straight to that bill on the board.',
    'The aging chart and the 90+ filter are still one click away from the breakdown\'s footer.',
  ],
}

export default note
