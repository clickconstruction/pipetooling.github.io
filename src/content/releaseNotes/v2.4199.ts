import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4199',
  date: '2026-09-30',
  title: 'The robot is scored against the whole bid, alternate included',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a bid that offers an alternate, the robot prices the alternate’s rows too — so its number is now compared with the base plus what each offered alternate adds, not the base alone. The scorecard line shows the parts.',
    'Your best effort records that whole as well, and the Robot Board’s “ours” and the moved-off-best-effort check read it the same way.',
    'Bids without an alternate are unchanged.',
  ],
}

export default note
