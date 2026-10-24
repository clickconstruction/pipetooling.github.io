import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5817',
  date: '2026-10-24',
  title: 'Quickfill: the Mark history window learns to read a habit, the maths first',
  kind: 'feature',
  highlights: [
    'Groundwork for the redrawn Mark history window on every Quickfill station: the maths that turns a station’s marks into the checklist ledger’s shape. Three tiles, one cell a workday for the last eight weeks with the open count in it, who marks it and the usual hour, and for a station with boxes the boxes’ own ticks.',
    'A day is due when the station’s own rhythm expected a look, the same idea the coloured chips use, counted in workdays, so a weekly station is never scolded for a Tuesday. Weekends are never due, and days before a station’s first mark draw nothing.',
    'Nothing changes on the page yet. The window itself is redrawn in the next release.',
  ],
}

export default note
