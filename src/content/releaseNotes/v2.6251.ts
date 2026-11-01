import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6251',
  date: '2026-10-31',
  title: 'An empty Pricing tab says what is missing and offers Adopt an existing bid',
  kind: 'feature',
  highlights: [
    'A bid with no counts yet used to show one sentence on Pricing and no press. Now it says what is missing and names the door: Open Counts to count the plans, or Open Labor to make the cost estimate.',
    'Adopt an existing bid is offered right there too, so a package can start by adopting older bids before anyone counts a thing.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
