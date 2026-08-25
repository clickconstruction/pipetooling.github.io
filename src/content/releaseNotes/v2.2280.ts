import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2280',
  date: '2026-08-25',
  title: 'A lifted card no longer loses to the scroll',
  kind: 'fix',
  highlights: [
    'On Review → Outstanding by person, holding a card lifted it — but the moment you moved your finger, the page scrolled and the card dropped back.',
    'Now the page locks the instant a card lifts and stays locked until you set it down, so you can carry it exactly where you want.',
    'Normal scrolling is untouched: a finger that starts moving right away still scrolls and never picks a card up.',
  ],
}

export default note
