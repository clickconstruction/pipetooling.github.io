import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5653',
  date: '2026-10-19',
  title: 'Bids: the sales tax rate is saved on the bid',
  kind: 'feature',
  highlights: [
    'The Tax % box on Takeoffs now belongs to the bid. Type the rate for that city and it stays; it used to reset to 8.25 every time the page loaded.',
    'The company default (8.25) lives in Settings → Bid Cover Letter Defaults beside the schedule-of-values numbers. A bid with no rate of its own uses it; clearing a bid’s box goes back to it.',
    'The Workbench’s cost now counts the tax on the bid’s material, as each row’s cost already did, so the strip’s profit and margin no longer run high by the tax.',
  ],
}

export default note
