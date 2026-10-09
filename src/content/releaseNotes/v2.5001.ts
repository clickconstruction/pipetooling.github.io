import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5001',
  date: '2026-10-08',
  title: 'GC projects: the contract’s days to pay set when a first bill is due',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Bill the customer has Days to pay in its terms: the days the contract gives the customer after the certificate.',
    'While a customer has never paid us, their bills fall due by those days. So a first bill can go late, and Remind them to pay shows.',
    'Once they have paid us, the days they really take count first. A day they promise always comes first.',
  ],
}

export default note
