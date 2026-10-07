import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4791',
  date: '2026-10-07',
  title: 'Map: the first view is the office',
  kind: 'feature',
  highlights: [
    'The Map page opens on the office: the diamond, the 25 and 50 mile rings, and the pins inside them. Fit all on the toolbar frames every pin and the office.',
    'A pin more than 300 miles from the office is drawn but never framed, so a wrong address no longer opens the map on open ocean. A line under the map lists each far address with its distance and count, with Show to fly there and Open on a single record.',
    'The drawing toolbar on the map is just the polygon tool, which is the one the area filter and the Court areas mode use.',
  ],
}

export default note
