import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2271',
  date: '2026-08-25',
  title: 'Completed tasks appear in Checklist review instantly',
  kind: 'fix',
  highlights: [
    'Completing a task on the Review tab (the ✓ on an Outstanding row, or ✓ Complete inside a card) now shows it in the Checklist review sign-off queue right above — no reload needed.',
    'The queue also refreshes when tasks are edited or added, and the To-sign-off tile count follows along.',
  ],
}

export default note
