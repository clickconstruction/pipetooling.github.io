import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5708',
  date: '2026-10-21',
  title: 'Messages: the search stays in the address, and empty lists fold on a phone',
  kind: 'feature',
  highlights: [
    'The Messages search now lives in the page’s address, like the kind pill. A reload keeps it and a link can carry it.',
    'On a phone, three empty lists fold to one line, New 0 · Needs a reply 0 · We owe them 0, so Went out and the search sit at the top. Press the line to open the lists; any count opens them on its own.',
  ],
}

export default note
