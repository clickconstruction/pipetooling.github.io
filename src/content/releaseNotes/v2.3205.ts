import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3205',
  date: '2026-09-09',
  title: 'Add the addresses the bid map is missing',
  kind: 'feature',
  highlights: [
    'Under the Bid Board map, “N bids have no map location yet” is now a link. It opens a sheet listing every bid the map can’t place — the ones with no address, then the ones whose address the map couldn’t find — each with its address ready to type or fix. Save, and the row says “Placed ✓ · 38 mi from the office” as soon as the map finds it.',
    'Each row offers “Check on Google Maps” for what you typed, an “Edit bid” door, and — when the customer has an address on file — a one-tap “Use it”. Saving an address on a bid with a blank Distance to Office fills the distance too, the way the bid form does.',
    'Tapping the “Bids on a map” title now hides and shows the map, the same as the Hide map link; the “follows the search and the trade pill” note beside the title is gone.',
  ],
}

export default note
