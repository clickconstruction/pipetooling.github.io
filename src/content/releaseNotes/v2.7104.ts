import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7104',
  date: '2026-11-12',
  title: 'A dev’s agent now sees which HR entries were corrected',
  kind: 'feature',
  highlights: [
    'When an agent reads a person’s HR file, an entry that a later entry corrected now says so and names the correction.',
    'A search of the file marks a corrected entry the same way, so an agent does not quote it as if it stood.',
    'The one-page brief of a case lists the newest corrections.',
  ],
}

export default note
