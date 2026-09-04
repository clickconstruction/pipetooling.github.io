import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2755',
  date: '2026-09-04',
  kind: 'fix',
  title: 'Takeoffs: every part is searchable again, and saved rows always show their part',
  highlights: [
    'The Combined takeoff search only knew the first 1,000 parts of the catalog, so parts later in the alphabet said "No parts match" even though they existed — and rows saved with one of those parts showed an empty box. Adding a part was saving all along; it just looked like it wasn\'t.',
    'The catalog now loads completely on Takeoffs, the Pricing assign-a-part modal, and the Materials assembly pickers. A row whose part is somehow not in the list fetches it by name anyway.',
    'The Duplicates page and the Settings orphan-price audit read the whole catalog too — they were quietly missing the same tail.',
    'If you created a part more than once because it looked lost, the extra copies are still there — the Duplicates page now finds them.',
  ],
}

export default note
