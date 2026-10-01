import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4287',
  date: '2026-10-01',
  title: 'Bids: hold a row to mark it, and find it marked on every tab',
  kind: 'feature',
  highlights: [
    'On Counts, Takeoffs, Labor, Pricing, Cover Letter, Submittals, RFI, Change Order and Lien Release, press and hold a bid row for half a second and it is marked: a violet wash, a bar at the left edge and “marked today” on the rail. With a mouse, hover the row and click the circle at its left instead. Hold or click again to clear.',
    'A mark follows the bid everywhere: the same row on every workflow tab, a lighter wash on the Bid Board, and a Mark button in the open bid’s title so you can mark it mid-pricing. Marks are yours alone and live on your account, so the iPad and the desk agree.',
    'The Marked switch beside Only my bids, and in the Bid Board’s tools row, shows just your marked bids. Search keeps the marks, so a marked match stands out of the results.',
    'Under the list, Clear marks clears them all. A mark on a bid that has since been won, lost or archived wears a dashed bar, and Clear finished marks takes just those.',
  ],
}

export default note
