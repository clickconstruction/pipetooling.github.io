import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1909',
  date: '2026-08-20',
  title: 'Sent estimates show the wait; accepted ones nag until they land',
  kind: 'feature',
  highlights: [
    'Sent rows now show how long the customer has had it — neutral for a week, amber "sent 9d ago — nudge?" after, and red when a change order\'s response-by date has passed.',
    'Accepted rows that aren\'t on a job yet carry an amber "not on a job yet" chip beside Apply to job, so accepted dollars never float silently.',
  ],
}

export default note
