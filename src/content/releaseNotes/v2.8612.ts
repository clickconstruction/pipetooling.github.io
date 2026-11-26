import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8612',
  date: '2026-11-26',
  title: 'A box’s own screen: an added part counts its own line, and an empty box is due no count',
  kind: 'fix',
  highlights: [
    'Adding a part to a box counts that part’s line and not the box. A box due a count stays due until someone counts it.',
    'An empty box is due a count nowhere: not on the On site list’s Count chip, the office’s chip, the map’s pins or the Job Mode card’s line. Its screen offers no count.',
    'A box with a Can’t find and none left still asks for a count, since a count is what clears the mark.',
    'The phone, the office and the Job Mode card now agree on which boxes are due.',
  ],
}

export default note
