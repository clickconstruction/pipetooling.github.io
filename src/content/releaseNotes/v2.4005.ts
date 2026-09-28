import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4005',
  date: '2026-09-28',
  title: 'Workflow: projections are read and saved by their own piece',
  kind: 'fix',
  highlights: [
    'Reading a project’s projections, adding one, editing one and deleting one moved out of the Workflow page into their own module, with tests for what each writes and for every refusal.',
    'Nothing on screen changes.',
  ],
}

export default note
