import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3294',
  date: '2026-09-11',
  title: 'Bids → Labor: a crew rate that is never blank, and the bottom line of the bid',
  kind: 'feature',
  highlights: [
    'The New view now carries a Crew rate card: the company rate is the last 90 days of recorded field wages (from People) times the burden factor, and a bid with no rate of its own is costed at it. One click saves it on the bid so Pricing and the printed documents read the same number; a typed rate stays an override you can clear.',
    'Two facts beside the rate: overhead per field hour (the same lens A the Overhead tab shows) and the hours clocked on this bid — shown, never added to the bid’s cost. The old Estimators Time box is retired: bid labor is recorded on the clock and already sits in the overhead pool, so the invented estimator dollars leave every total, print and PDF.',
    'A bottom line under the grid — Direct cost of this bid: labor, materials, driving, travel, other direct, the total, and the margin at the bid value — the number the job’s budget will carry after the win.',
  ],
}

export default note
