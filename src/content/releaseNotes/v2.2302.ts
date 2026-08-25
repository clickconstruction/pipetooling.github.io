import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2302',
  date: '2026-08-25',
  title: 'Stray spike lines vanish from the Map',
  kind: 'fix',
  highlights: [
    'Some roadmap links drew a long needle into empty canvas and doubled straight back — a stray line that connected to nothing.',
    'Those degenerate detours are now filtered out of every link\'s route; a link that loses its route falls back to a clean simple curve.',
    'Real routing is untouched: links still thread the gaps between stage boxes instead of slicing through them.',
  ],
}

export default note
