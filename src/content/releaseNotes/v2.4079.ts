import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4079',
  date: '2026-09-28',
  title: 'Workflow: the stage list is its own piece',
  kind: 'fix',
  highlights: [
    'The list of a project’s stages — every card, the money markers and balance column beside them, and the empty state with “Create from template” — moved out of the Workflow page into its own component. The page is now about a quarter of the size it was three days ago.',
    'The page’s test now also creates a workflow from a template, opens the windows a stage card offers, and reads the balance column’s margin.',
    'Nothing on screen changes.',
  ],
}

export default note
