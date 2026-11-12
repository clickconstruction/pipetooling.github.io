import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7025',
  date: '2026-11-12',
  title: 'First look: a customer\'s photos reach Google Drive within minutes',
  kind: 'fix',
  highlights: [
    'What a customer sends through a First look now wakes the photo sweep by itself, so it files to Drive within about five minutes.',
    'Before, the files waited until some other photo in the app woke the sweep.',
  ],
}

export default note
