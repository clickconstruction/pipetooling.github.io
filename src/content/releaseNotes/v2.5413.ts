import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5413',
  date: '2026-10-12',
  title: 'Messages: the step a customer is on, with its presses, in one line above the reply box, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A person’s step card can fold to one line: the step, whose move it is, how many days, and the presses that move it.',
    'A homeowner waiting on their estimate gets Approve for them, Move the day, Send it again and a press for their no. A bill out gets Send the bill again and Mark paid by check.',
    'Approve for them records that one of ours pressed it by phone.',
    'Nothing on screen changes yet. The strip comes with the reply box’s screens.',
  ],
}

export default note
