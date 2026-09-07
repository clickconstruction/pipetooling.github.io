import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3027',
  date: '2026-09-07',
  title: 'Robots: the plumbing estimator only picks up plumbing bids',
  kind: 'fix',
  highlights: [
    'A robot shadow was opened on an Electrical-division bid and priced it as plumbing; every door the robot claims work through now checks the bid is plumbing first.',
    'A shadow that should never score — wrong division, wrong reference, a spoiled run — can be voided with a reason instead of sitting in the queue waiting to grade itself.',
  ],
}

export default note
