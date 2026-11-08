import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6751',
  date: '2026-11-08',
  title: 'My email: the mail you send lands on the job by itself',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Send a mail from your own Gmail to someone who is on exactly one open job, or whose company has one open job, and within five minutes it is on that job’s thread as ours, under your name. No press. Mail you sent before today is left alone.',
    'The line says so: from Wendi’s mail · put here by the app. A grey line on the thread says why, and that later mail in the conversation lands there too.',
    'Press Untag under the line to take the conversation off. The app will not put it back. Tagging it by hand on the My email tab lifts that.',
    'A mail to someone the app does not know, to yourself, or to someone on two open jobs lands nowhere. Your Inbox keeps its press. The switch on Your account turns all of it off.',
  ],
}

export default note
