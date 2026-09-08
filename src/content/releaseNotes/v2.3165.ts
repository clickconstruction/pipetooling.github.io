import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3165',
  date: '2026-09-08',
  title: 'Takeoffs: the "How do you want to cost this takeoff?" box asks once, then remembers',
  kind: 'feature',
  highlights: [
    'On Bids → Takeoffs the box that asks Old / One at a time / Sheet now appears only the first time you open a bid on a device. Your pick is remembered and every bid after that opens straight in that view.',
    'Change your mind any time with the Old / One at a time / Sheet pills beside the bid name — that switch is remembered too.',
    'If you have already picked a view with the pills on this device, the box will not appear again at all.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
}

export default note
