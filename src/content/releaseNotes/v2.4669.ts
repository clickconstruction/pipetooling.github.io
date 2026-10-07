import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4669',
  date: '2026-10-05',
  title: 'Legal portal: the firm\'s link behaves like a key',
  kind: 'fix',
  highlights: [
    'Rotating the firm\'s link now asks first, and both Rotate and Turn off say that the link in every email already sent to the firm stops opening too.',
    'Agreement PDF links on the attorney\'s portal open for fifteen minutes instead of an hour. The page refreshes itself before they run out.',
    'The portal\'s answers are never cached, and nothing the page opens learns its address.',
  ],
}

export default note
