import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4510',
  date: '2026-10-04',
  title: 'Pipeline: Not scheduled is the button, the Assign work link is gone',
  kind: 'feature',
  highlights: [
    'On a Pipeline row with nothing booked, the blue Assign work… link under Activity is gone. It opened the same sheet as the green calendar at the start of the row.',
    'The Not scheduled flag is now the button. Click it to open Assign work with the job already picked.',
    'Phone cards are unchanged: they have no green calendar, so the Assign work… chip stays beside not scheduled.',
  ],
}

export default note
