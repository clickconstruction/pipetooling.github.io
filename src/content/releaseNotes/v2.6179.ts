import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6179',
  date: '2026-10-30',
  title: 'Archived bids sit apart from the undecided on a Development page',
  kind: 'fix',
  highlights: [
    'The Bid, undecided count and its dollar figure now hold only the bids in play: sent and waiting on the answer, or still being worked. A bid archived off the working board with no send is no longer counted as undecided, the same rule the Bid Board uses for Not yet won or lost.',
    'The Bids count still names how many are archived. When nothing is in play the Bid, undecided card reads No bid in play and lists the won, the lost and the archived, each as its own group.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
