import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4796',
  date: '2026-10-07',
  title: 'Map: the same map as the Bid Board and the Pipeline',
  kind: 'feature',
  highlights: [
    'The Map page now draws on the same map the Bid Board, the Pipeline and the Dashboard use. A clicked pin opens a card with the record, its kind and stage, the address, Open and Directions.',
    'On a phone a tapped pin becomes a bar under the map with two big buttons, so the pin stays in view.',
    'On a desktop the mouse wheel scrolls the page past the map until the map is clicked once. The + and − buttons, dragging and the pins work from the start.',
  ],
}

export default note
