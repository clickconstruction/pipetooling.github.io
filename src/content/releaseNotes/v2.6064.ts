import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6064',
  date: '2026-10-29',
  title: 'Quick replies by keyboard: the eleven starter lines',
  kind: 'feature',
  highlights: [
    'Eleven customer quick replies ship with the app, each with a shortcut: /gotit, /access, /photo, /late, /back, /bill, /thanks, /paid, /found, /estimate and /remind. Type one in a reply box and press Enter.',
    'Three sit on a step, so the app has words of its own there: /found on What we found, /estimate on Approved for the reminder a day after the estimate, /remind on Paid for the reminder on the pay-by day. The other eight sit on no step, so no automatic send changes.',
    'A line the office already has keeps its place: a starter line whose words, shortcut or step the office has saved is left out, and the office changes or removes any of the eleven like its own.',
    'The lines are read from the database, so they appear once the migration is pushed. The guide Edit the quick replies lists them.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
