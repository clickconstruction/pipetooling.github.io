import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6275',
  date: '2026-11-01',
  title: 'My email in Messages: the reader behind the tab',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The app can now read your own Inbox and Sent for the coming My email tab. It reads your own address and no one else’s, and it keeps nothing while you look.',
    'Tagging a conversation puts every mail in it on the job you pick, with its files and a copy of each mail as it came. A mail the shared boxes already took is tied to the job, never written twice.',
    'Your mail in Gmail gets the label Tagged in ClickTooling, so Gmail shows what is on a job. Untag takes the lines, the files and the label back off.',
    'Nothing shows yet. The tab comes with the next update.',
  ],
}

export default note
