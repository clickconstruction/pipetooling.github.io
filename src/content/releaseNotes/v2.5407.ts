import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5407',
  date: '2026-10-12',
  title: 'Messages: a homeowner hears when their job is booked, started, done, billed and paid, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'When a job is booked or moves to Working, Ready to Bill, Billed or Paid, the app can text the customer that step’s quick reply.',
    'Each step stays off until the owner turns it on. A step texts once a day at most, and never a number that sent STOP.',
    'The Jobs board can show a dot on a job whose customer wrote and is still waiting on us.',
    'Nothing on screen changes yet. The switches, the sends and the dot come with the screens.',
  ],
}

export default note
