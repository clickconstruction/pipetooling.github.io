import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3188',
  date: '2026-09-09',
  title: 'Add checklist item sits at the top of the screen on a phone',
  kind: 'fix',
  highlights: [
    'On a phone the Add checklist item card now docks to the top, right under the status bar, instead of floating in the middle with empty space above it. The title and the "What needs to be done?" box are the first things on screen.',
    'The card runs edge to edge with rounded bottom corners and lighter padding, and the form scrolls inside it above the keyboard. Desktop and tablet are unchanged.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
