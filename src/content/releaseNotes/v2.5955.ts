import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5955',
  date: '2026-10-26',
  title: 'Money in: this week, and what last week still owes',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A new bar under the four money cards on the Dashboard answers what is coming in this week. Closed, it is one line: Came in, Still expected and Last week still out.',
    'Press it to see the week by day. Each payment is a chip on the day it landed or should land, tagged landed, at the bank, in the drawer, their word or a pace guess.',
    "Last week's money that never came has its own column on the left, and a check that came back shows red. Every chip opens the job or Accounts Receivable.",
    'When they tell you a new day, press their chip and pick the day. It saves as their word and the chip moves.',
  ],
}

export default note
