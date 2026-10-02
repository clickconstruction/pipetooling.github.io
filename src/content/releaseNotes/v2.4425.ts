import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4425',
  date: '2026-10-02',
  title: 'Pricing: "Bids like this" waits until the bid has a price',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a bid with no price yet, the Bids like this line showed only the GC with "no decided bids yet". It now stays away until there is something to compare.',
    'A GC you have decided bids with still shows its record before the bid is priced.',
  ],
}

export default note
