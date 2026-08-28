import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2461',
  date: '2026-08-28',
  title: 'Saving a loss reason tells you if it didn’t take',
  kind: 'fix',
  highlights: [
    'Saving a loss reason from the Lost summary could quietly go nowhere if you didn’t have permission to edit that bid — it now shows an error instead of pretending it saved.',
  ],
}

export default note
