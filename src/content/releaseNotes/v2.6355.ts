import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6355',
  date: '2026-11-02',
  title: 'The older sets under a part read date first, with a dashed line between sets and the presses together at the right',
  kind: 'feature',
  highlights: [
    'On a development’s Plans, press N older on a part and each older set now starts with its date: the date on the sheets, else the day it came as “came Oct 30, 2026”. The name, the kind and the source follow, and the memo reads on its own line under them.',
    'A soft dashed line separates one set from the next, so a long list reads as rows.',
    'Open ↗, Build from this set and × sit together at the right edge of every row and move to the next line as one group on a narrow screen, never split.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
