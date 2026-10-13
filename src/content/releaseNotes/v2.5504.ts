import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5504',
  date: '2026-10-13',
  title: 'Messages: one email sent to both inboxes shows once',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'An email sent to both the bids inbox and the team inbox now lands once on its sender’s thread.',
    'The inbox that reads it second only marks its copy as taken. It adds no second line and no second set of files.',
    'Emails read before this stay as they are.',
  ],
}

export default note
