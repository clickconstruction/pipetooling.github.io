import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5712',
  date: '2026-10-21',
  title: 'Messages: a card for the owner that says which switches are still off',
  kind: 'feature',
  highlights: [
    'A line at the top of Messages reads Finish switching Messages on, with how many of the eight switches are on.',
    'Open it to see each switch with its state and a door to its setting: Send texts, Read bids@, the seats, the team inbox, Reply push, the phone seats, the reminders and Office hours.',
    'Press Later to fold it for a week. It goes on its own once all eight are on. Only the owner and devs see it.',
  ],
  roles: ['dev', 'master_technician'],
}

export default note
