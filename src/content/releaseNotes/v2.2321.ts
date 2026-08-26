import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2321',
  date: '2026-08-25',
  title: 'Data health add-date rows breathe',
  kind: 'fix',
  highlights: [
    'Rows with an "＋ add date" button no longer squeeze the paid date under the amount — the date column gives those rows the room they need.',
  ],
}

export default note
