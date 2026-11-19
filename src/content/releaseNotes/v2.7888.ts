import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7888',
  date: '2026-11-18',
  title: 'Trips: how far is far is one setting',
  kind: 'feature',
  highlights: [
    'The Trips look shows on a site far from the shop, and the phone asks about a trip there. Far was fixed at 150 miles.',
    'It is now one setting. A dev changes it in Settings, on the Trips card under Jobs, bills and liens, from 25 to 1,000 miles.',
    'Nothing changes until it is set. A site that already has a trip still shows its look at any distance.',
  ],
}

export default note
