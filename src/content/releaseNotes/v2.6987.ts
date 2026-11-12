import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6987',
  date: '2026-11-11',
  title: 'Permits: a missing owner is asked for again sooner',
  kind: 'fix',
  highlights: [
    'A found owner is still kept for a month. A card where the county had no parcel was also kept a month, so a new lot the county added later stayed blank.',
    'Now a card with no parcel asks the county again after a week.',
    'A lookup that failed, for example when the county did not answer, asks again after an hour. Before, one timeout left the card blank for a month.',
  ],
}

export default note
