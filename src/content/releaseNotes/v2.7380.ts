import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7380',
  date: '2026-11-15',
  title: 'A subcontractor’s job window shows our lead’s number, not the customer’s',
  kind: 'feature',
  highlights: [
    'When a subcontractor opens a job, Who now names the person who runs the job for us, with their number to call. Job Mode’s card on the Dashboard does the same.',
    'The customer’s number and email are no longer shown to a subcontractor. The customer’s name stays.',
    'Our lead is the master technician on the job’s team, or the superintendent when no master is on it. With neither, the window shows the office’s number.',
    'Helpers, the superintendent and estimators still see the customer’s number.',
  ],
}

export default note
