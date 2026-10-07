import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4804',
  date: '2026-10-07',
  title: 'Map: one pin per address, and a rail in place of the table',
  kind: 'feature',
  highlights: [
    'The Map page draws one pin per address. An address with several jobs, bids or estimates wears their count, takes the liveliest record\'s color and the most urgent ring, and its card lists every record with Open.',
    'A rail beside the map replaces the table: the filter box, the selected place\'s card with Directions, three distance bands from the office that double as filters, and the places nearest the office. Resting on a row pulses its pin.',
    'Drawing an area on the map now narrows the map and the rail to the pins inside it. On a phone the rail sits under the map and the selected place is the bar.',
  ],
}

export default note
