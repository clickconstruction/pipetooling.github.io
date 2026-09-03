import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2680',
  date: '2026-09-03',
  title: 'Session notes — every clock session on one line',
  kind: 'feature',
  highlights: [
    'Jobs → Pipeline has a new "Session notes" button: every clock session in the last 30 days as a single line — time, hours, who, where the time was booked, and what they wrote — searchable across all of it.',
    'Spot a session booked to Office that says "helped terry on 961 trim": when a note names a job the session isn\'t on, a purple "961?" chip offers a one-tap Assign. Every row also has the usual Assign / Change.',
    'Click a person or a job to pin it, narrow by Office / Nothing / A job / A bid, and group by day, person, or job. Each job row\'s new "Sessions" link opens the view already pinned to that job.',
  ],
}

export default note
