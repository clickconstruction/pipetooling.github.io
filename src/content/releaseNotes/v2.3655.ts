import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3655',
  date: '2026-09-20',
  title: 'Quick time add, part 1: the rules for adding a short off-hours call or email to your hours',
  kind: 'infra',
  highlights: [
    'Groundwork for a new button for office staff: add 5 to 30 minutes, in fives, for a call or an email handled off the clock — without clocking in and out around it. Nothing on screen changes yet; the button arrives in the next release.',
    'The rules live in the database, so they cannot be skipped: today only, never while you are clocked in, never on top of hours you already have, a sentence saying what it was, and a daily ceiling of two hours.',
    'A quick add is an ordinary hours entry — it goes to approval and pay like any other — but it is marked, so whoever approves hours can always tell it from a punch.',
  ],
}

export default note
