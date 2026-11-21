import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8097',
  date: '2026-11-20',
  title: 'Before we start: a bullet that did not save keeps its words',
  kind: 'fix',
  highlights: [
    'When Add a bullet fails, the words you typed now stay in the box. Press Add again to send them.',
    'Before, the box was emptied and the bullet had to be typed again.',
  ],
}

export default note
