import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8650',
  date: '2026-11-26',
  title: 'Lien desk: a payoff card names no clearing day before the money is recorded',
  kind: 'fix',
  highlights: [
    'A payoff card showed Check clears with a day months back when one of its liens had an older check on it. The card now shows that day only for a check that paid a lien off.',
    'While every lien at a place still waits on its money, the card shows no clearing day. The Check clears stop says the money comes first, as before.',
  ],
}

export default note
