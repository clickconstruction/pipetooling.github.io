import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7312',
  date: '2026-11-15',
  title: 'Stickers: the ground for a run that names its boxes',
  kind: 'feature',
  highlights: [
    'A run of stickers can now carry the names of the boxes it is for, G78 to G300, with each sticker keeping its number as well. Nothing on a screen changes yet: the Print stickers window gains its Names field in the next release.',
    'The rule for a typed range is ready: G78-300 steps the number, A1-D50 the letter and the number as four rows of fifty, G78B-D the twins at one spot, and G1-100C every spot plain, then B, then C. A range that runs downward, passes 999 or makes more than 500 stickers is refused in words.',
    'The database holds a named run to the box rule, as many names as stickers and each box named once, and refuses in words before a number is taken. A blank sticker that carries a name makes a box of that name when it is placed with none typed.',
  ],
}

export default note
