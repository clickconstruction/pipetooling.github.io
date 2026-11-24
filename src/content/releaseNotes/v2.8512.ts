import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8512',
  date: '2026-11-24',
  title: 'Maps: a new address is placed by Google first, with no wait',
  kind: 'fix',
  highlights: [
    'A new address is now placed by Google first, and by the US Census when Google cannot find it. Placing several new addresses at once no longer waits a second between them.',
    'The app no longer asks OpenStreetMap to look up an address. OpenStreetMap had been turning every such request away, so it placed nothing and only added a wait.',
    'Nothing changes on the maps themselves. When Google Maps cannot load, the map is still drawn from OpenStreetMap, with every saved pin on it.',
  ],
}

export default note
