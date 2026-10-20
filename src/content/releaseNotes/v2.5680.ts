import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5680',
  date: '2026-10-20',
  title: 'Deselect an alternate right on the Cover Letter',
  kind: 'feature',
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'On a bid with no versions, the Cover Letter\'s Step 1 now lists every other price with an Offer checkbox — untick one and the letter drops that alternate on the spot.',
    'Before, the panel only said "manage offers on the Pricing tab", so taking a stray alternate off the letter meant leaving the letter to hunt for the right price card.',
    'The checkbox is the same offer switch the Pricing card has: the bid room, the Approval PDF and the Pricing tab all follow it, and re-ticking brings the alternate back.',
    'Two offered prices at the same amount get an amber note — "probably a copy" — so a duplicated price can\'t ride a letter unnoticed.',
  ],
}

export default note
