import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5820',
  date: '2026-10-24',
  title: 'Quickfill Email: the app can count a box’s labels in Gmail',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'Every 15 minutes, once the owner switches it on, the app reads each counted box’s Inbox, Follow Up and Next Actions as that mailbox and keeps what the Email station will show: how many threads sit in each label, how old the oldest is, when each stuck thread arrived and who wrote, and what came and cleared that day.',
    'It reads under Google’s metadata-only permission, so it can see senders, subjects and dates and never the words of an email. It changes nothing in Gmail: no label, no archive, no read mark.',
    'Nothing shows on the station yet. The switch stays off until the owner adds the metadata permission to the app’s Google delegation, a five-minute step in the Workspace admin console.',
  ],
}

export default note
