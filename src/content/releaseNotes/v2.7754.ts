import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7754',
  date: '2026-11-18',
  title: 'Checklist: the History tab is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the History tab moved out of the big Checklist page into its own file, the second tab to leave after Manage.',
    'Nothing changes on screen. The grid, the one-off ledger, the phone ledger and edit mode draw as they did, checked mark for mark.',
    'The Checklist page is now under 2,900 lines, down from 4,039 at the start of the night.',
  ],
}

export default note
