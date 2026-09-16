import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3518',
  date: '2026-09-16',
  title: 'What customers see: the law firm strip reads right, and every caption is in office words',
  kind: 'fix',
  highlights: [
    'The Confirmed page card on the Collections law firm strip showed raw page code instead of the page. It now renders the page itself.',
    'Every step\'s caption now says what sends it the way the office knows it, for example "Jobs → Contract sweep → Send" rather than a system name.',
  ],
}

export default note
