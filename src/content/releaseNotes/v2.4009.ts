import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4009',
  date: '2026-09-28',
  title: 'Workflow: the Projections & Ledger panel is its own piece',
  kind: 'fix',
  highlights: [
    'The Projections | Ledger | Left bar above a project’s stages, and the table behind its Details button, moved out of the Workflow page into their own component, with tests for the figures, the table’s rows and what each role is shown.',
    'Nothing on screen changes.',
  ],
}

export default note
