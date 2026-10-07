import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4790',
  date: '2026-10-07',
  title: 'Court areas: the night places the addresses the map never saw',
  kind: 'feature',
  highlights: [
    'Every night, up to 300 property addresses with no point on the map are placed first, then put in their precinct. The backlog of unplaced records drains by itself.',
    'A property record with a point but no county takes the county the point sits in, and says where the county came from.',
  ],
}

export default note
