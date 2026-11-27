import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8717',
  date: '2026-11-27',
  title: 'A sub’s statement says “We owe them nothing today” when nothing is owed',
  kind: 'fix',
  highlights: [
    'On Jobs → Subs → Ledger → By sub, the last line of a statement read “We owe {sub} settled today.” for a sub with nothing owed.',
    'It now reads “We owe {sub} nothing today.”',
    'For a sub paid past a sheet it reads “We owe {sub} nothing today. They are paid over by $20.00.”',
  ],
}

export default note
