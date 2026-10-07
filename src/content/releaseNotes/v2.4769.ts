import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4769',
  date: '2026-10-07',
  title: 'Map: draw the justice precincts',
  kind: 'feature',
  highlights: [
    'The Map page has a Court areas mode for the office: draw a precinct with the polygon tool, name it with its county and the precinct as the county writes it, and save it. Every area shows on the map with its name.',
    'The panel under the map lists the areas by county with where each came from, lets you rename or remove one, and says how many pinned addresses sit inside a drawn area, outside every area, or on a line.',
  ],
}

export default note
