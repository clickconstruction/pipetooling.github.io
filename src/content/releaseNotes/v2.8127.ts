import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8127',
  date: '2026-11-20',
  title: 'Trips: a joined trip cannot come back from an old page',
  kind: 'fix',
  highlights: [
    'A page left open since before a join could bring back the trip that was joined away.',
    'Its days then stood on two trips, and Put on a bill could bill them twice.',
    'Now the app refuses it and names the trip that holds those days. The page then reads the trips again.',
    'To take a join back, press Split in two on the joined trip.',
  ],
}

export default note
