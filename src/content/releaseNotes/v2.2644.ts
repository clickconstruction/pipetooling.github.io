import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2644',
  date: '2026-09-02',
  title: 'Price book: the Price field stops fighting your typing',
  kind: 'fix',
  highlights: [
    'Adding or editing a price book entry with the book in Combined price mode: the Price field no longer reformats while you type, so entering 21.00 lands as 21.00 instead of the cursor jumping and producing 2.01. Type the whole number in one go.',
  ],
}

export default note
