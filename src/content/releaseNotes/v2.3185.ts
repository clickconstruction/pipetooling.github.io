import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3185',
  date: '2026-09-09',
  title: 'People → Users on a phone: a directory, one line per person, swipe for actions',
  kind: 'feature',
  highlights: [
    'On a phone the Users tab is now a directory: one card per kind, one line per person — an initial with a colored status ring, the name, the hours count and a "Needs you" pill — so a screen shows about a dozen people instead of three.',
    'Tap a row to open their desk. Swipe a row left for Desk, Imitate (devs, one tap) and More, which holds the row\'s other actions like Invite, Edit and Archive.',
    'The toolbar is search and + Add; Team leads, Accounts and Archived sit under ⋯. The filter chips scroll sideways in one row, and Needs you and Hours show how many are waiting. Group headers stay pinned while you scroll their list.',
    'Nothing changes on a desktop or tablet.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
