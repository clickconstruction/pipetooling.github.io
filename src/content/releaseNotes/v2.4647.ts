import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4647',
  date: '2026-10-05',
  title: 'Legal portal: the firm\'s key is kept locked',
  kind: 'fix',
  highlights: [
    'The app no longer keeps the law firm\'s portal key where office accounts can read it. The emails to the firm still carry their link.',
    'The Firm\'s link dialog shows the link once, when you create or rotate it. Copy it then.',
    'Preview works any time you are signed in, and nothing you do in the preview is saved.',
  ],
}

export default note
