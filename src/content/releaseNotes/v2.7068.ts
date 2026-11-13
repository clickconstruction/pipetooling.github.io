import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7068',
  date: '2026-11-12',
  title: 'My email: you are told when a developer saves your mail to a job',
  kind: 'feature',
  highlights: [
    'A developer can save a conversation from your mailbox onto a job for you. Until now nothing told you it had happened.',
    'The Needs you card now shows a line under “Your mail”: who saved it, how many conversations, and onto which job. On a phone it is under the Inbox tab.',
    'It is in the app only. Nothing is sent to your inbox and you get no push. Several saves close together show as one line with a count.',
    'The line stays for seven days. The record stays under Settings, on the Activity logs tab, and only you can read it.',
  ],
}

export default note
