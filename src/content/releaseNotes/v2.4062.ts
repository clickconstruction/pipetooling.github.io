import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4062',
  date: '2026-09-28',
  title: 'Workflow: who is looking, and who can be assigned, is read by its own piece',
  kind: 'fix',
  highlights: [
    'Working out the viewer’s role and name, the list of people a step can be assigned to, and who counts as a subcontractor moved out of the Workflow page into its own module, with tests.',
    'The page itself has its first test: it loads a project as each kind of user and checks the stages shown, the Hide Old Steps summary, and what Approve does to the list.',
    'Nothing on screen changes.',
  ],
}

export default note
