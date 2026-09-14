import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3444',
  date: '2026-09-14',
  title: 'Job accounts: Mark opened from the Dispatch card saves again',
  kind: 'fix',
  highlights: [
    'Mark opened… on a tech’s job-account ask in the Dispatch inbox failed to save when the house had a rep on file. The ask now carries the rep’s real contact record, and the sheet never writes a rep it cannot identify.',
    'The Job accounts chips on job cards no longer trip a styling warning when they change state.',
  ],
}

export default note
