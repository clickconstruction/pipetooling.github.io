import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7007',
  date: '2026-11-12',
  title: 'First look: the customer\'s page loads forty times lighter',
  kind: 'fix',
  highlights: [
    'The page a customer opens from a First look link is now a small page of its own. It loads about 60 KB before its first word, where it loaded 2.4 MB.',
    'The link in the text is the same. A customer on a weak signal sees the page much sooner.',
  ],
}

export default note
