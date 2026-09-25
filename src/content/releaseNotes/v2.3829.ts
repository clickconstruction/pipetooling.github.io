import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3829',
  date: '2026-09-25',
  title: 'Documents: searching “unpaid” finds only the unpaid supply bills',
  kind: 'fix',
  highlights: [
    'On Documents → Supply houses, typing “unpaid” in the search box listed every supply-house invoice, paid ones included. It now lists only the bills still unpaid.',
    '“paid” still finds the paid bills and “open” still finds the unpaid ones. The words count on their own, so a search like “unpaid ferguson” works too.',
  ],
}

export default note
