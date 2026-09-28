import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3943',
  date: '2026-09-27',
  title: 'Workflow: the Jobs and Subs lines are their own pieces',
  kind: 'fix',
  highlights: [
    'The Jobs line at the top right of a project — a chip per job that opens it in place, and + Create Job — and the Subs line under it moved out of the Workflow page into their own small components, with tests for what each shows.',
    'Nothing on screen changes: the job chips are there when the page first appears, as before.',
  ],
}

export default note
