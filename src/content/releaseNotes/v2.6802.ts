import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6802',
  date: '2026-11-09',
  title: 'After a delete, no "Back to their desk"',
  kind: 'fix',
  highlights: [
    'Deleting a person made by mistake closes their desk. The toolbar then offered "Back to <name>\'s desk" for someone who no longer exists. It no longer does: the way back is kept only for a desk you closed yourself.',
  ],
}

export default note
