import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2136',
  date: '2026-08-22',
  title: 'Roadmap Timeline polish — readable month labels on phones, clearer far-off goals',
  kind: 'fix',
  highlights: [
    'On a phone the Timeline calendar now labels every second or third month instead of printing them on top of each other; hover or long-press a column for its name.',
    'When the projected finish is more than a year out, the caption leads with tasks left and the pace that would land it within the year, then the honest far-off date.',
    'Timeline stage rows announce their name and progress to screen readers; the full-screen Map header follows your theme instead of staying light.',
  ],
}

export default note
