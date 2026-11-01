import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6266',
  date: '2026-11-01',
  title: 'My email in Messages: the groundwork for putting your own mail on a job',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Messages is getting a My email tab. It shows your own Inbox and Sent beside the threads, and one press puts a whole conversation on a job or a bid.',
    'This first step lays the ground. The app learns to guess the job, to fold notices and newsletters, and to say what a tag writes. Nothing shows yet. The tab comes with the next updates.',
    'The tab is on for every office member, and you can turn it off. Nothing from your mail is kept until you tag a conversation.',
  ],
}

export default note
