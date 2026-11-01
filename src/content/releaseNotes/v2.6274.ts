import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6274',
  date: '2026-11-01',
  title: 'My email in Messages: put a conversation from your own mail on a job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Messages has a second tab, My email. It shows your own Inbox and Sent, read live from Gmail, and keeps nothing until you tag.',
    'The app guesses the job from the subject and the sender. Press Yes, or Tag… to pick the job, and the whole conversation lands on the job with its files.',
    'Open a mail to read it whole, to tag or untag it, or to reply in Gmail. Nothing on the tab counts, marks read or replies.',
    'Turn the tab off, or leave a Gmail label out, on Settings under Your account, in the card My email in Messages.',
  ],
}

export default note
