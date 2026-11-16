import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7417',
  date: '2026-11-15',
  title: 'Your pay: no door to a portal that is turned off',
  kind: 'fix',
  highlights: [
    'On a subcontractor’s job window, Open your portal is offered only while their portal is on.',
    'Before, a sub whose portal had been turned off but who still had a short address was offered a door that led nowhere. Nobody was in that state.',
  ],
}

export default note
