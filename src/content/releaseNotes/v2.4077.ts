import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4077',
  date: '2026-09-28',
  title: 'Workflow: loading a project’s stages is its own piece',
  kind: 'fix',
  highlights: [
    'Loading a project’s workflow and its stages — with each stage’s line items, history and sub work orders — moved out of the Workflow page into its own module, with tests for what it reads for each kind of user.',
    'Nothing on screen changes.',
  ],
}

export default note
