import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6824',
  date: '2026-11-09',
  title: 'A supply house paper counts as a purchase only while its bill is on file',
  kind: 'fix',
  highlights: [
    'When a bill is deleted from a supply house’s list, the lines read from its paper no longer count toward what the company buys. The lines are kept, so a bill recorded again by mistake can own them once more; they just drop out of every count until then.',
  ],
}

export default note
