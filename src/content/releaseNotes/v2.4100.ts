import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4100',
  date: '2026-09-28',
  title: 'Jobs → Stages: the row markers load from their own piece',
  kind: 'fix',
  highlights: [
    'Behind the scenes: the markers on Stages rows (a demand letter sent, the contract chip, a hazmat fee, a lien release on file) now load from their own piece instead of inside the Stages page.',
    'Nothing changes on screen: the same people see the same markers, and a marker that cannot load still just leaves the row plain.',
  ],
}

export default note
