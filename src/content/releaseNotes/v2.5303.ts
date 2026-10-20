import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5303',
  date: '2026-10-12',
  title: "Messages: the customer's page on a GC job",
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A customer’s portal now shows each GC job as its own page, with Home, Money, Schedule and Papers. Home leads with the one thing we need from them.',
    'Money shows how far the job is paid with each pay application, the change orders waiting, and the statement folded. A paid on time line shows only when every payment was.',
    'Schedule says what moved and why, in their words. Papers lists what they signed and what waits on them, with the same sign and accept forms as before.',
    'When a customer opens a paper there, the app records it for the office. It turns on once the database changes are live.',
  ],
}

export default note
