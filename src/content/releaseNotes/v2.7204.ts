import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7204',
  date: '2026-11-13',
  title: 'A test of Materials on site no longer fails by chance',
  kind: 'fix',
  highlights: [
    'Nothing in the app changed. One of the checks that runs before a change ships failed now and then on a busy machine, and held up changes that had nothing to do with it.',
    'The check waited a fixed moment for a press on site to reach the office. It now waits until the press has really arrived.',
  ],
}

export default note
