import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7638',
  date: '2026-11-17',
  title: 'Prospects: the Follow Up tab is its own piece, and the page is a quarter of its size',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The calling deck draws and behaves as it did.',
    'This is the last of nine cuts. The Prospects page went from 5,600 lines to about 1,550, and every piece that left has its own tests.',
  ],
}

export default note
