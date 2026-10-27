import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5982',
  date: '2026-10-27',
  title: 'Messages: an email rescued from Spam lands too',
  kind: 'fix',
  highlights: [
    'The inbox reader now takes an email that reached the Inbox after it arrived, such as one Gmail first put in Spam and someone moved out, or one a filter held. Before, only an email delivered straight to the Inbox was read, and a rescued one stayed in Gmail with no label.',
    'Found on the Messages walk: the owner’s own reply sat in the team inbox, Primary tab, unread by the app.',
  ],
}

export default note
