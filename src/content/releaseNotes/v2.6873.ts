import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6873',
  date: '2026-11-10',
  title: 'Permits: read the city’s records further back',
  kind: 'feature',
  highlights: [
    'Builders has a new press beside the line that says where the records start: Read back to, with a day. Each press reads about three more months of the city’s permits.',
    'Older permits count for a builder and show on a bid’s address. They never land on the skim, Kept or Closed, so nothing old waits on an answer.',
    'Every count moves with it. Once the records reach back a year, a builder’s line says in the last year again.',
    'A read back that stops partway says why and leaves the start of the records where it was.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
