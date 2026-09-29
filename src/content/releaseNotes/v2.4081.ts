import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4081',
  date: '2026-09-28',
  title: 'Workflow: the step windows are their own piece',
  kind: 'fix',
  highlights: [
    'The six windows a stage card opens — delete a step, send it back, skip it, set its start, plan its expected dates, and assign someone — moved out of the Workflow page into their own component, with tests for what each shows and does.',
    'Nothing on screen changes.',
  ],
}

export default note
