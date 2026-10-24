import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5819',
  date: '2026-10-24',
  title: 'Quickfill: a station’s Mark history reads as a habit, eight weeks and its boxes at a glance',
  kind: 'feature',
  highlights: [
    'Open a station’s history from the chart icon in its header, or from 📈 history on the phone’s round, and the window opens on three tiles, This week, Streak and Missed, over one cell a workday for the last eight weeks. The number in a cell is how many items were open at that mark: green when nothing was, amber when something was, a ✓ when the station keeps no count, a dashed box on a day the station’s rhythm expected a look and none came, a blue ring on today.',
    'Tap a day and the line under the grid reads its mark: the day, the time, who and the count. Under that, who marks the station and how often, the usual time of day with a band of every mark’s hour, and whether the count is falling.',
    'On a desk, Office Arriving, Assistant Dailys and Difficult people also show The boxes: one row a box, a small cell a workday for the last four weeks, green when the box was ticked and dashed when it was not, and the boxes left unticked on most days named. Each box counts from its first tick, so a box added last week is not marked down for the weeks before. On Assistant Dailys the one left is the box that reads when leaving.',
    'The rows are still there below, the last seven days and everything earlier folded, and the Note column shows only on the stations that ask for a note. A phone keeps the tiles, the grid and the rows. Nothing is written by any of it.',
  ],
}

export default note
