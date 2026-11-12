import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6985',
  date: '2026-11-11',
  title: 'Permits: a map point for Austin’s permits in Williamson County',
  kind: 'fix',
  highlights: [
    'Austin sends about half of its Williamson County permits with no map point. The pull now takes the point from the lot’s parcel at Williamson County, as it does at Travis County.',
    'Measured on the last 75 days: 68 of the 70 such permits take a point, so they get their map picture, their miles from the office and their pin.',
    'A night Williamson County does not answer leaves the points already found in place, and Travis County is still asked.',
  ],
}

export default note
