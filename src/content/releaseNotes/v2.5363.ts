import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5363',
  date: '2026-10-12',
  title: 'Messages: the files that come with an email, and a paper offered for filing',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'An email in a thread shows its files under its words. Press one to open the message, where each file has Open.',
    'Open shows our copy, kept when the email came. A file too big to keep stays in Gmail, and its row says so.',
    'A file that reads like a trade partner’s certificate of insurance or W-9 is offered under its message. Filing a certificate opens their company window with the file in the form.',
    'It is not takes the offer away for everyone. The app never files a paper on its own.',
  ],
}

export default note
