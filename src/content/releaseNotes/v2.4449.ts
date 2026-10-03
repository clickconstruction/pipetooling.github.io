import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4449',
  date: '2026-10-02',
  title: 'Submittals: the procurement log keeps the rows approved on an earlier revision',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Rev N+1 from the rows sent back carries only those rows, and the approved rows stand on Rev N. Before this they left the procurement log with it, and any order typed on their lines went out of sight.',
    'The log now lists every row approved on an earlier shared revision whose tag the newest no longer holds. The line reads approved on Rev N, and its order dates and PO are back where they were typed.',
    'Tap such a line and its row opens to change the house, lead time or stage. The product the GC approved cannot be edited there.',
    'The GC\'s review room shows the same rows on its Procurement card, so the card no longer goes blank after a resubmit.',
  ],
}

export default note
