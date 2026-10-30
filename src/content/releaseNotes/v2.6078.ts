import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6078',
  date: '2026-10-29',
  title: 'A job’s activity tags read in dark mode',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent', 'subcontractor', 'helpers'],
  highlights: [
    'The small tags on a job’s activity and notes — Clock, Billing, Money, Status and the rest — were dark colours in both themes, so in dark mode they sank into the card. Each now takes its colour from the theme: the same in light, a lighter shade in dark.',
    'Nothing else about the activity feed changed.',
  ],
}

export default note
