import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8218',
  date: '2026-11-21',
  title: 'In kind: the screens that count late money leave a bill an arrangement pays out',
  kind: 'fix',
  highlights: [
    'The Dashboard’s Accounts Receivable card counts money owed only. A line under it names what is scheduled in kind, and its window lists those bills apart with no days on them.',
    'On the Pipeline those bills are in neither the 30+ chip nor the 90+ chip. A new In kind chip counts them, and pressing it lists them.',
    'Who owes what, Quickfill’s Billed Awaiting Payment and the Pay speeds By customer list no longer show such a bill as late under its customer.',
    'The Bridge leaves those bills out of its Collect pile, its cash coming and what is owed to you, and names them as scheduled in kind, not counted.',
  ],
}

export default note
