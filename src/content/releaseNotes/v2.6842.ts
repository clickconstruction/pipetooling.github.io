import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6842',
  date: '2026-11-10',
  title: 'Permits: the skim count sits on the strip, in one row',
  kind: 'fix',
  highlights: [
    'Skim no longer repeats its count on a second line. The Skim chip on the strip is the count, so the card starts higher, most of all on a phone.',
    'The strip now moves the moment you answer. A kept card reads on Kept and a passed card on Closed while Undo is still open.',
    'On a desk, Up next says best first, and what you kept and passed this sitting shows under that list.',
  ],
}

export default note
