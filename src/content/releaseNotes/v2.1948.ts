import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1948',
  date: '2026-08-21',
  title: 'Partnerships: only linked documents count as the deal agreement',
  kind: 'fix',
  highlights: [
    'The Agreements tab\'s "signed" chip, lapse countdown, and §8a notice gating now key on documents explicitly linked to the partnership — a partner\'s old handbook signatures no longer read as the deal being signed.',
    'Documents split into "This deal\'s agreement" and "Other paperwork on file", with one-click link/unlink between them.',
    'Lapse math now uses the company calendar (America/Chicago), not UTC.',
  ],
}

export default note
