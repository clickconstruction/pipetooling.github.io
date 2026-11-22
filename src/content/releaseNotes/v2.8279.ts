import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8279',
  date: '2026-11-21',
  title: 'The Bridge on a phone: Money owed and Crew hours fit the screen',
  kind: 'fix',
  highlights: [
    'On a phone the Bridge no longer slides sideways once Money owed is open. Crew hours had the same fault and is fixed with it.',
    'Each panel is one column on a phone: the charts, then the words, then the waterfall, then the sources.',
    'A source reads as three lines on a phone. Its name with its door, where it is read from, and what can be wrong.',
    'Nothing changes at a desk or on a tablet, and no number changes anywhere.',
  ],
}

export default note
