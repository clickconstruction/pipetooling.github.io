import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5451',
  date: '2026-10-13',
  title: 'Messages: open a customer’s messages from their name',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A speech bubble sits beside a customer’s name on Customers, Jobs and Estimates. Press it to open their thread in Messages.',
    'The first time, the app starts their thread with the number and the email on file.',
    'Pressing the name itself still does what it did before.',
    'The Dashboard’s Needs you card now has a Customers line when customers wait on us.',
  ],
}

export default note
