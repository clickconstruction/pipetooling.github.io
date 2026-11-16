import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7406',
  date: '2026-11-15',
  title: 'Stickers: put a range on boxes in one press',
  kind: 'feature',
  highlights: [
    'These are on boxes puts a range of named stickers on their boxes with no scan. Type the names you stuck on, such as G78-150, pick how the boxes sit and their place, and press once.',
    'Each name gets its box with its sticker on it. A name that is a box on the site already takes its sticker. A name whose sticker is on a box is left as it is, and the window says so.',
    'The press is on a named run in the Runs fold on a job’s Materials page, and under the boxes on the phone’s On site tab.',
    'The window counts what the press will do before you press it, and says what happened after. A scan then only adds what is inside.',
  ],
}

export default note
