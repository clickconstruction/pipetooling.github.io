import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6958',
  date: '2026-11-11',
  title: 'Permits: a map point for Austin permits the city sends without one',
  kind: 'fix',
  highlights: [
    'About four in ten Austin permits come from the city with no map point. The pull now takes the point from the lot’s parcel at Travis County, by the parcel number the permit carries.',
    'Those permits get their map picture, their miles from the office and their pin on the map, and the owner lookup can fall back to the point.',
    'A permit whose parcel the county does not hold yet stays without a point, and a night the county does not answer leaves the points already found in place.',
  ],
}

export default note
