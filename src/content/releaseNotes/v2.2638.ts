import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2638',
  date: '2026-09-02',
  title: 'The property ledger reaches the Job form and the lien forms',
  kind: 'feature',
  highlights: [
    'Edit Job gains a Property record row: link the job to one of the customer’s (or GC’s) saved addresses — with a one-click suggestion when one matches the job address — and see at a glance whether it’s lien-ready.',
    'The Lien Tooling prefill now carries the linked property’s filing county and legal description onto the mechanic’s lien and release forms — the two fields that were always blank before.',
    'New Settings block (dev): extend or correct the city→county suggestion map without a deploy — one “City = County” line each.',
  ],
}

export default note
