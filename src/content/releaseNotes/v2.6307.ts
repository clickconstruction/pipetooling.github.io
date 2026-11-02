import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6307',
  date: '2026-11-01',
  title: 'Documents: the four ledgers read as rows, not as wrapping columns',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
  highlights: [
    'On Documents → Estimates, Bids, Jobs and Supply invoices the title owns the row: the service tag and the name on the first line, the site address under it. The separate site column is gone.',
    'The customer column shows the name alone. Hover it for the address. The Docs, Status and Total cells never wrap, so a row is as tall as its title and no taller.',
    'Status is a chip on all three ledgers, the same size and colours. The Estimates ledger shows its linked job under the estimate instead of a mostly empty column.',
    'Supply invoices drop the bare dash before an unnumbered job, show the share only when an invoice is split across jobs, and no longer clip the address.',
  ],
}

export default note
