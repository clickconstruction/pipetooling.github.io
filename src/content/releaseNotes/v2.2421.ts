import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2421',
  date: '2026-08-28',
  title: 'Bid Board pills and Edit Bid buttons keep their styling on click',
  kind: 'fix',
  highlights: [
    'The per-GC outcome pill on the Bid Board and the Win/Loss buttons in Edit Bid could silently lose their font or border styling after a click — both now hold steady.',
  ],
}

export default note
