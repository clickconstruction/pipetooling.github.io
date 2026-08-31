import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2521',
  date: '2026-08-30',
  title: 'Robot takeoffs learn three lessons from the Casa Linda backtest',
  kind: 'feature',
  highlights: [
    'The robot now de-duplicates fixture marks that land twice along crop-tile seams, so overlapping reads can no longer inflate a count.',
    'Robot footage is scaled from flat plan feet to developed feet per system, with the factor and its source printed for the reviewer — closing most of the footage gap against human takeoffs.',
    'Robot doctrine now requires reading every sheet in a plan set, demolition plans included — demo fixtures are priced scope.',
  ],
}

export default note
