import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8610',
  date: '2026-11-25',
  title: 'Clock out lists the bids you worked on today',
  kind: 'feature',
  highlights: [
    'When you clock out after a day on bids, the sheet lists the bids you worked on, with a strip of your day above them. You do not type them.',
    'A tick in the bid’s colour takes a bid off the list, and another press puts it back. A bid you only opened sits below, one press from the list.',
    'With a bid on the list, Complete clock out is ready at once and says how many bids it keeps. The note is now Anything else? and can stay empty.',
    'The sizes are rough. The office reads your list beside your hours, where your note has always been.',
  ],
}

export default note
