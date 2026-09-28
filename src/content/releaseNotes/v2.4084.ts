import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4084',
  date: '2026-09-28',
  title: 'Autosave keeps a change you undo while it is saving',
  kind: 'fix',
  highlights: [
    'In Edit Bid, Edit Job and an estimate draft: if you changed a field and put it back while the first change was still saving, the form said "Unsaved change…" and waited until you closed it. It now saves the put-back value a moment after the first save finishes.',
  ],
}

export default note
