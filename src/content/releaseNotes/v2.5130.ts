import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5130',
  date: '2026-10-10',
  title: 'Bids: Undo of a price book switch puts the Pricing tab back on the first book',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
  highlights: [
    'After Undo of a price book switch in History, the open Pricing tab now shows the book the bid is back on.',
    'Before, it kept showing the book you had switched to until you reloaded, so a price typed there went into that book.',
  ],
}

export default note
