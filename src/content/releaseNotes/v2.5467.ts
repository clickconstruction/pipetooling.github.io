import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5467',
  date: '2026-10-13',
  title: 'Messages: a file in a job’s Drive folder has the app’s own lasting link',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A file in a job’s Drive folder now has a link of the app’s own, as a file that came on an email does.',
    'The link opens the file in Drive for the office team, and asks anyone signed out to sign in first.',
    'It opens a file only from that job’s folder, so a link cannot reach anything else in Drive.',
  ],
}

export default note
