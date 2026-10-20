import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5690',
  date: '2026-10-20',
  title: 'Bids: the + version window says what an unchecked copy means',
  kind: 'fix',
  roles: ['estimator', 'assistant', 'master_technician', 'dev'],
  highlights: [
    'In the + version window, the line under Start from used to claim "copies its counts, takeoff and prices" even with Copy all the source\'s prices unticked.',
    'Now it follows the checkbox: unticked, it says the new version starts unpriced and that the Pricing tab will offer your books — which, since the start panel landed, it does.',
  ],
}

export default note
