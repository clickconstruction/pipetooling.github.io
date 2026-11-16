import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7496',
  date: '2026-11-16',
  title: 'Bids and plan sets: room for a schedule and a sheet count',
  kind: 'infra',
  highlights: [
    'The database can now keep a bid’s promised schedule, with a start and an end that a person types.',
    'A set of drawings can now keep how many sheets it has.',
    'Nothing changes on a screen yet. The Development page’s By date view will draw both in the next updates.',
  ],
}

export default note
