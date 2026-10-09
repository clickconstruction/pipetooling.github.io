import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5032',
  date: '2026-10-09',
  title: 'AIA pay applications: each one shows the bill it became, and what was paid',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The AIA window’s history shows the bill each application became, and what it was paid, like Paid $13,588.20 · Aug 22.',
    'An application with no bill reads Bill not yet tied. Tie a bill… picks one, starting on the bill whose amount is the payment due.',
    'On a job with saved applications, Bill Customer asks which pay application the bill is, and ties them when the bill goes.',
  ],
}

export default note
