import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8468',
  date: '2026-11-24',
  title: 'Document builder: the Sub NDA’s left side has an Edit and a Share view',
  kind: 'feature',
  highlights: [
    'The Sub NDA’s left side now has a switch. Edit shows the map and the pages that changed. Share shows the link and the send to a GC.',
    'The link’s card and the send used to sit under the map, so the left side ran four cards long.',
    'A note you started typing on Share is still there after a look at the map.',
    'On a phone, Share shows the link and the send alone. The address keeps the view you were on, so a reload lands there.',
  ],
}

export default note
