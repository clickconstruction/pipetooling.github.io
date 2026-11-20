import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8120',
  date: '2026-11-20',
  title: 'Job pace and the Projects board: a small job can no longer hide a large gap',
  kind: 'fix',
  highlights: [
    'A small job that was well over its hours could read On pace, because the gap was under one crew day. One project read On pace at 140% of its hours with the work at 80%.',
    'A gap now also counts when it is a tenth of the job’s hours budget or more, ahead or behind. A gap of a crew day or more counts as it always did.',
    'A gap under a crew day is said in hours: 6 hours behind on the Projects board, and a chip that reads -6 h. The Job pace card on the phone uses the same rule, so the office and the crew still agree.',
  ],
}

export default note
