import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7887',
  date: '2026-11-18',
  title: 'Workflow page: a failed load says what could not be loaded, and why',
  kind: 'fix',
  highlights: [
    'When a project, its workflow, its steps or its line items cannot be loaded, the page now names which one and gives the reason: no access, a link to nothing, or no connection.',
    'A project you cannot open used to show the database’s own wording. It now reads as a sentence.',
    'A save on a project with no workflow never tries to make one. Start a workflow is the only press that does.',
  ],
}

export default note
