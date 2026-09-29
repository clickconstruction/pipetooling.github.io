import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4078',
  date: '2026-09-28',
  title: 'Workflow: starting, completing, approving and assigning a stage is its own piece',
  kind: 'fix',
  highlights: [
    'Starting, completing, approving and reopening a stage, its percent complete, its notify settings, its notes, deleting it and assigning someone to it moved out of the Workflow page into their own module, with tests for what each writes and for every refusal.',
    'Nothing on screen changes: approving a stage still folds its card and opens the next one.',
  ],
}

export default note
