import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8576',
  date: '2026-11-25',
  title: 'An address the map could not place: the reason is a plain sentence, and the sheet’s small presses take a thumb',
  kind: 'fix',
  highlights: [
    'When no map service could place an address, the reason now reads No map service could find this address. Before, some rows showed a service’s name and an error code.',
    'The same plain words show on the Bid Board’s sheet, the Map page’s list, Quickfill and Settings.',
    'When a map service placed an address outside the lower 48 states, the line says so and says to check the city, the state and the ZIP.',
    'On a phone, the bid’s number, Check on Google Maps, Edit bid and Use it on the Bid Board’s sheet are now as tall as a fingertip.',
  ],
}

export default note
