import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5538',
  date: '2026-10-14',
  title: 'Phone and texts: Send texts is the first card, and the wait line in a thread links to it',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Settings → Phone and texts, Send texts is now the first card. It is the one card a text waits on. A line under it says nothing else on the page is needed first: the seats and the inboxes only add names and a second number.',
    'While texts are off, the wait line under Text in a thread or a job window says the same. For the owner or a dev, the words Settings → Phone and texts are a link to the switch. Everyone else reads that the owner or a dev turns it on.',
  ],
}

export default note
