import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4598',
  date: '2026-10-05',
  title: 'Bids: every change is now kept, with who made it',
  kind: 'infra',
  highlights: [
    'From today, every price, count, takeoff line, labor hour and bid detail anyone changes is kept, with who changed it and when.',
    'A fixture that is removed keeps what was on it: its price, its parts and its stage split.',
    'Nothing shows it yet. A History view on the Bids page comes next, and it will reach back to today.',
  ],
  roles: ['master_technician', 'assistant', 'controller', 'estimator', 'primary'],
}

export default note
