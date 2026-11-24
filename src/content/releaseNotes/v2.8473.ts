import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8473',
  date: '2026-11-24',
  title: 'Maps: a place to remember an address the map cannot place',
  kind: 'infra',
  highlights: [
    'The database can now remember an address that no map service could place, with the reason and the day it was checked.',
    'When someone fixes the address and the map places it, that memory is cleared by itself.',
    'Nothing on screen changes yet. The maps start using it in the next step, so they stop asking about the same address on every open.',
  ],
}

export default note
