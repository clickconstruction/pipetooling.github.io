import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7299',
  date: '2026-11-14',
  title: 'Receipt texts: one text for each charge',
  kind: 'feature',
  highlights: [
    'Every card charge gets its own text and its own link, even when two post minutes apart. Before, charges inside one hour shared one text.',
    'The evening reminder is one a charge too, so each reminder names one charge and opens its own link.',
    'Only the first text to a number carries the hello; the ones after it are the one line, as before.',
  ],
}

export default note
