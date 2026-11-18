import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7667',
  date: '2026-11-17',
  title: 'Supply houses: how a house’s jobs and PO codes are read now has its own tests',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. A house’s bills still name their jobs, and the PO check on a bill reads as it did.',
    'Three small rules the page wrote more than once are now one tested function each: a bill’s jobs and shares, the jobs’ names, and the PO Generator codes for a house.',
  ],
}

export default note
