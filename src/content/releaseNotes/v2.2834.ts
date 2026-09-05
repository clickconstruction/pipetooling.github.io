import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2834',
  date: '2026-09-05',
  title: 'Statement round: three small fixes from the live run-through',
  kind: 'fix',
  highlights: [
    'The round email\'s subtitle now shows your whole book outstanding, matching the scoreboard at the bottom, instead of only the GCs ready today.',
    'A GC with no sender that was marked sent or spoken to can be undone from its chip again.',
    'The Payment follow-up list says "coldest first, then biggest" when a cold or cool read is moving GCs up the list.',
  ],
}

export default note
