import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3499',
  date: '2026-09-16',
  title: 'The tip strip now clears itself once the tip is recorded',
  kind: 'fix',
  highlights: [
    'Recording a tip on a deposit wrote everything correctly but left the strip on screen and the deposit still counted as unmatched until you reloaded the page. The deposit list now refreshes with it, so the meter completes and the deposit leaves To match straight away.',
    'Housekeeping alongside it: database types regenerated now that the tip change is live, and the note written on the tip payment falls back to its standard wording again.',
  ],
}

export default note
