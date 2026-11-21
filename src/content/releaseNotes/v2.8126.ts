import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8126',
  date: '2026-11-20',
  title: 'The dev seat has room to grow to 10 MB',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A one-time test showed that the 20 MB limit on a bundled function does not count the size Supabase stores it at. A bundle stored at 28.8 MB was taken and started.',
    'So the size check on the dev seat rises from 5.8 MB to 10 MB of code. At this week’s growth that is about three weeks of room, where 5.8 MB gave about five days.',
    'Every other function keeps its 4.5 MB check. The one-time test job is gone, as it said it would be.',
  ],
}

export default note
