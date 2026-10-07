import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4805',
  date: '2026-10-07',
  title: 'Map: the records the map cannot place, in one sheet',
  kind: 'feature',
  highlights: [
    'A line under the map counts the records with no map location and the addresses far from the office. It opens a sheet with every one of them: the records with no address, the addresses the geocoder could not find with its reason and a Google Maps check, and the far pins with Show on the map.',
    'Every row opens its record, so the address is fixed where it lives. The office can ask Google again for a far address from the sheet.',
    'The geocoding list left the page header, and the Debug corner is gone. Review geocodes is reached from the sheet.',
  ],
}

export default note
