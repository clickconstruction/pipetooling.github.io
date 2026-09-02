import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2607',
  date: '2026-09-01',
  title: 'Division 22 audit: the section picker opens again',
  kind: 'fix',
  highlights: [
    'Clicking "pick a section…" in the Division 22 codes audit looked like it did nothing — the dropdown was opening behind the modal. It now opens on top, with search.',
  ],
}

export default note
