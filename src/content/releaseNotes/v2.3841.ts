import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3841',
  date: '2026-09-25',
  title: 'Bids → Pricing: every price option card shows its real total',
  kind: 'fix',
  highlights: [
    'On some older bids the Pricing tab shows price option cards from more than one GC version at once. The cards from the other versions read $0 — so they looked unpriced, lost their margin and could not be picked for “Copy prices from”.',
    'Each card is now priced on its own version’s fixture counts, so its total matches what that option really sends.',
  ],
}

export default note
