import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6257',
  date: '2026-11-01',
  title: 'Put an email from your own Gmail on a job: a new guide (punch list #230, PR 0)',
  kind: 'feature',
  highlights: [
    'A new help guide shows a way that already works. Forward an email from your own Gmail to team@ or bids@. It lands on the thread of the person who wrote it, with its files and your note.',
    'The email lands on the job its own subject names, by the job’s number or its whole name, else on the job with their star. The guide shows how to move it to another job.',
    'An email you send from your own Gmail reaches the thread when you copy team@ or bids@. The email window in Messages now names the inbox to copy and links the guide.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
