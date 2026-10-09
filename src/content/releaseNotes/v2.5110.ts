import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5110',
  date: '2026-10-09',
  title: 'What customers see: the sample portals’ bills and payments read like a real portal',
  kind: 'fix',
  highlights: [
    'The sample customer portals on Settings → What customers see now build their bills, lien waivers and payments with the same code as a real portal, so they can only show what a real one would.',
    'The general contractor sample now shows a bill its customer pays that the office shared with it, and the Your payments section with the two checks it wrote.',
    'Each bill’s check reference is its job number, as on a real portal, and the general contractor’s own link no longer tags its bills as a GC’s.',
  ],
}

export default note
