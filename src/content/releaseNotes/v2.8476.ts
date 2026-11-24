import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8476',
  date: '2026-11-24',
  title: 'Takeoffs: every row button stays in reach in a narrow window',
  kind: 'fix',
  highlights: [
    'On Bids → Takeoffs, a part line’s drag handle and delete ended up under the What Pricing sees rail when the window was narrower than about 1,184 px. They are now in reach at every width.',
    'When the window is too narrow for the sheet and the rail side by side, the rail moves under the sheet. Every panel and button of the rail is still there.',
    'One at a time puts its list of fixtures above the fixture in a narrow window, so the page no longer scrolls sideways.',
    'On a phone the lines scroll inside their own box, with the drag handle and the delete pinned at its right edge.',
  ],
}

export default note
