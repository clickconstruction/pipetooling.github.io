import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2147',
  date: '2026-08-23',
  title: 'Quickfill: Billed Awaiting Payment no longer double-counts',
  kind: 'fix',
  highlights: [
    'The section listed every billed job AND every bill line — most bills twice — so it read "122 lines · $488,035" while the Pipeline showed $240,142. It now uses the Pipeline\'s own rows: one row per bill, Collections excluded. Today: 60 lines · $240,142.48.',
    'Same columns, same click into Job Detail; the "N open" count and the total now agree with Jobs → Pipeline.',
  ],
}

export default note
