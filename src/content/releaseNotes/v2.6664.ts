import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6664',
  date: '2026-11-07',
  title: 'The walk names why the bids inbox could not be read',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'When the walk cannot read the bids inbox, the held step now says why in the function’s own words, such as Gmail’s rate limit and the time it names, instead of reading as an estimate email that never arrived.',
  ],
}

export default note
