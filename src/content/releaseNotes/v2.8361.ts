import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8361',
  date: '2026-11-23',
  title: 'Retry after a lost signal is a thumb-sized press on a phone',
  kind: 'fix',
  highlights: [
    'When a screen could not load because the signal dropped, the Retry press under the message was a small one on a phone.',
    'It is now 44 px tall on a phone, the height of the other presses on the crew screens, so a thumb lands on it.',
    'On a desktop the press keeps its size.',
  ],
}

export default note
