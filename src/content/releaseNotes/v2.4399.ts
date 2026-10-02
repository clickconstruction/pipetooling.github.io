import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4399',
  date: '2026-10-02',
  title: 'A page no longer stays frozen after a window closes',
  kind: 'fix',
  highlights: [
    'Closing some windows left the page behind them unable to scroll until you refreshed. Pay history on People was one of them.',
    'Nine windows had their own older way of holding the page still. They now share the one the rest of the app uses, which also holds on an iPhone.',
    'If a page is ever frozen with no window open, the app now frees it by itself.',
  ],
}

export default note
