import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2241',
  date: '2026-08-24',
  title: 'Pay speeds and aging read the same bill date',
  kind: 'fix',
  highlights: [
    'The pay-speed math now uses the same bill-date rule as the board’s aging chips — a hand-set est. bill date counts when no billed timestamp exists.',
    'Bills dated only by est. date stop being invisible to customer pay-speed history.',
  ],
}

export default note
