import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7905',
  date: '2026-11-19',
  title: 'Dashboard: a primary’s My Bids opens folded on a phone too',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary'],
  highlights: [
    'For a primary, My Bids opens folded to its heading at every width. On a phone it used to stand open, and a long list of old bids pushed the rest of the Dashboard down the page.',
    'The heading keeps its count, like My Bids (24), and New Bid stays beside it while the list is folded. Press the heading to see the bids, and press it again to fold them.',
    'Every other role’s My Bids opens as it did. On a phone the heading is now a press for them too, so they can fold the list.',
  ],
}

export default note
