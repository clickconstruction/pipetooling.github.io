import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7615',
  date: '2026-11-17',
  title: 'Prospects: the page has its first render test',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. This adds a test that opens the Prospects page as each role and presses its main controls.',
    'The cuts that follow lean on it: a piece that moves out of the page must still pass.',
  ],
}

export default note
