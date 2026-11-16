import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7396',
  date: '2026-11-15',
  title: 'Stickers: the first scan reads the name off the sticker',
  kind: 'feature',
  highlights: [
    'A scan of a sticker printed as G78 opens Sticker G78 is new on It is a new box, with G78 filled in. One press saves the box.',
    'When the site already has a G78, the sheet opens on that box with the press that puts the sticker on it. It is a different box offers the next letter at that spot, G78B.',
    'The sticker’s number steps back on the screens. A box named by its own sticker shows the name alone. A sticker that reads another name than its box says so, and a scan of it says so too.',
    'A sticker with a number only works as before, with its number beside the box’s name.',
  ],
}

export default note
