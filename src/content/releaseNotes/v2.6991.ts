import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6991',
  date: '2026-11-11',
  title: 'Permits: a San Antonio address finds its lot when the county spells it another way',
  kind: 'fix',
  highlights: [
    'The city writes LANE where the county writes LN, and “N 1604 W” where the county writes “N LOOP 1604 W”. The Property line used to miss those lots by their address.',
    'Bexar County is now asked for the house number and the street’s name, as the other counties are.',
    'Measured on 320 San Antonio addresses: every lot found before is still found, and 18 more are found by their address.',
  ],
}

export default note
