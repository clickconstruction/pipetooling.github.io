import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8332',
  date: '2026-11-23',
  title: 'Dashboard: one row at the top switches between Task Mode, the Dashboard and Job Mode',
  kind: 'feature',
  highlights: [
    'There is a new row at the top of the Dashboard: Task Mode, Dashboard and Job Mode. The page you are on is blue. Tap another part to switch, and tap again to come back.',
    'On a phone the row hides once you have used it. Pull the page down from its top, or tap the small grey bar there, and the row comes back.',
    'The row is the one place to switch. The green card that offered Job Mode is gone, and the gear menu no longer lists Job Mode or Task Mode. Dispatch Mode is still in the gear menu.',
    'In Task Mode the row is the way out. An estimator opens the app on Bids, so an estimator has no row and keeps Job Mode and Task Mode in the gear menu.',
  ],
}

export default note
