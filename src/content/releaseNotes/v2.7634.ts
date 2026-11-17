import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7634',
  date: '2026-11-17',
  title: 'Prospects: the page’s data is one piece the tabs read through',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The deck, the list, the card that is up and the calling order load and follow the address as they did.',
    'The page’s reads and its calling order moved into one tested piece, so each tab can be cut out next without touching how the data loads.',
  ],
}

export default note
