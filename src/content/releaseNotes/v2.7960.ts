import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7960',
  date: '2026-11-19',
  title: 'Trips: the ground for joining a trip with the next',
  kind: 'infra',
  highlights: [
    'The database can now make two trips that were really one into one trip. The joined trip keeps the first trip’s number and holds everyone and every day from both.',
    'A trip that is joined away is kept for 90 days, marked with the trip it was joined into.',
    'Nothing on screen changes yet. The press, Join with the next, comes next.',
  ],
}

export default note
