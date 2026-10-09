import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5094',
  date: '2026-10-09',
  title: 'Workflow: the contact window is its own piece',
  kind: 'fix',
  highlights: [
    'The window that opens when you tap an assignee’s name on a stage card moved out of the Workflow page into its own small component. It still shows the name, the email and the phone, with tests for each.',
    'Nothing on screen changes.',
  ],
}

export default note
