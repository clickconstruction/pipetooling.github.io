import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2445',
  date: '2026-08-28',
  title: '"Use this price on this bid" now really means the bid',
  kind: 'fix',
  highlights: [
    'Carrying a book edit across (from v2.2444) used to update only the price option you were viewing — an alternate or another GC\'s packet on the same bid kept the old price, including the one on that GC\'s letter. It now updates every price option on the bid still holding the same old price, and the banner counts them before you press.',
    'A price option you\'ve re-priced on purpose is never touched — only untouched inherited prices follow the book.',
    'The offer to update a price now appears only when you\'re editing the book this bid actually prices from; editing somebody else\'s book no longer offers to put their price on your bid. Adding a missing entry still works from any book.',
    'The add/edit entry form no longer opens behind the price book drawer on narrow screens.',
  ],
}

export default note
