import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4770',
  date: '2026-10-07',
  title: 'Court areas: the map fills itself in',
  kind: 'feature',
  highlights: [
    'Every night, each property record is put in its justice precinct from the office’s court map, using the point the map already holds for its address. A precinct typed by hand is never changed.',
    'On the Map page, Classify now runs the same job by hand and says how many records were placed, how many sit outside every area, and how many sit on a line.',
    'A dev can import a county’s published precinct lines into the map in one step, for the counties that publish them.',
  ],
}

export default note
