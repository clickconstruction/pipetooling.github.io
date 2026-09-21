import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3673',
  date: '2026-09-21',
  title: 'Materials by stage, PR 3: the printed schedule of values and the letter section',
  kind: 'feature',
  highlights: [
    'Bids → Takeoffs → Stages panel: Print schedule of values prints the page Wendi used to build by hand — the three stages with raw material, the factored figure and the share, the fixtures named under each stage, and a second page listing every fixture with its stage (3, 1 + 2 ½ · ½, or mixed) so a reviewer can check the boxes against the numbers.',
    'The Rough Takeoff print now shows each fixture’s stage beside its count.',
    'Cover Letter: a Materials by stage pill beside Payment schedule adds a short section — one line per stage with the factored figure — to the letter and the Approval PDF. Off unless you turn it on; the payment schedule stays its own section.',
  ],
}

export default note
