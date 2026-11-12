import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6978',
  date: '2026-11-11',
  title: 'Permits: a San Antonio permit’s owner read at the permit’s point',
  kind: 'fix',
  highlights: [
    'Bexar County often has no parcel under a permit’s street address, on new buildings and where the county spells the street another way. The Property line now reads the parcel at the permit’s point, as the other four cities do.',
    'Measured on 300 San Antonio addresses: commercial cards that name an owner go from 50 in 101 to 95. Houses go from 52 in 199 to 193.',
    'The card says the parcel was read at the permit’s point and gives the county’s own address for it.',
    'A card that said no parcel before is read again the next time it is opened.',
  ],
}

export default note
