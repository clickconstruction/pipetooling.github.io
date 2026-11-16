import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7391',
  date: '2026-11-15',
  title: 'Stickers: a run names its boxes, G78 to G300',
  kind: 'feature',
  highlights: [
    'Print blank stickers opens on a new field, Names, filled with the site’s next free name. Type a range such as G78-300 and the stickers print reading G78, G79 and on, each with its own code.',
    'How many follows a typed range, and the press names it: Print 223 stickers, G78 to G300. A range can step a letter too, so A1-D50 is four rows of fifty. Clear the field for stickers that carry a number only.',
    'Each sticker prints its name large and its number small above the link, on a strip no longer than before. A name of five to seven characters prints a little smaller.',
    'The window says when names are boxes on the site already. When an earlier run printed the same names and they are on no box yet, the press waits for Print them anyway.',
  ],
}

export default note
