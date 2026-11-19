import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7847',
  date: '2026-11-18',
  title: 'Lien desk on a phone: the two prints share one row on every phone',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a phone 375 wide the Board’s two prints stood one over the other. They were 2 px too wide to share the row.',
    'They now stand side by side on every phone, each half the row.',
    'On a very narrow phone a press wraps its own words onto two lines and stays beside the other.',
  ],
}

export default note
