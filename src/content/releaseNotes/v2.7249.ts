import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7249',
  date: '2026-11-14',
  title: 'Materials on site: a stand-in is never a price, and two fittings never share a row',
  kind: 'fix',
  highlights: [
    'A part whose parts book price is $0 or the 999,999 stand-in now reads its invoice price, or no price. It no longer counts as a known price in what a site is worth or in what walked away.',
    'On a site’s screen, two fittings whose sizes swap ends are two rows. A 1/2 pex x 3/4 mip adapter and a 3/4 pex x 1/2 mip adapter shared one row and one total, and so did a 4" to 2" reducer and a 2" to 4".',
    'A decimal size keeps its point: a .5" coupling is no longer the same row as a 5" coupling.',
    'The same fitting typed in another word order is now two rows, which Same part joins in one press.',
  ],
}

export default note
