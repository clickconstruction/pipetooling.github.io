import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5723',
  date: '2026-10-21',
  title: 'Needs You: the move window on the Dashboard and Quickfill',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'A Job accounts line on the Dashboard and on Quickfill reads “$7,474.71 on 14 current invoices is not on a job account yet”, with the soonest window to close and the asks out — the same numbers as the strip on Accounts payable.',
    'It turns amber a week before the soonest window closes and red within three days.',
    'Work the list opens the worked list on Materials → Supply houses, by house and job, with the rep to call.',
  ],
}

export default note
