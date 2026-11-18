import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7740',
  date: '2026-11-18',
  title: 'Bill Customer: the edit-dates window is its own piece',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the small window that edits a bill’s due date and service date moved out of the Bill Customer window into its own file.',
    'Nothing changes on screen. The dates open, save and cancel exactly as before, and no send or record press was touched.',
  ],
}

export default note
