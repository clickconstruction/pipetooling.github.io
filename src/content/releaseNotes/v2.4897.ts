import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4897',
  date: '2026-10-07',
  title: 'Map buttons show only for people the Map opens for',
  kind: 'fix',
  roles: ['superintendent'],
  highlights: [
    'A superintendent no longer sees Bid map on a builder, or Open the full map on Who’s in. The Map page was never open to the role, so both buttons bounced back.',
  ],
}

export default note
