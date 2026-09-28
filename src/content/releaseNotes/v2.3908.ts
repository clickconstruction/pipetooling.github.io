import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3908',
  date: '2026-09-27',
  title: 'Edit Job: the footer is its own piece',
  kind: 'fix',
  highlights: [
    'The bottom row of the job form — Delete, Undo changes, the autosave line, Close, and Create Job on a new job — and the red “could not be saved” banner above it were drawn inside the form; they are now one component with a smoke test.',
    'What the autosave line says, and who sees Delete, are tested rules of their own.',
    'Nothing on screen changes.',
  ],
}

export default note
