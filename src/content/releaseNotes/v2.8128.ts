import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8128',
  date: '2026-11-20',
  title: 'Add to a list: a second press after a failure makes nothing twice',
  kind: 'fix',
  highlights: [
    'When Add to a list fails partway, pressing the button again finishes from where it stopped.',
    'It no longer makes a second supply house, a second customer or a second person on file.',
  ],
}

export default note
