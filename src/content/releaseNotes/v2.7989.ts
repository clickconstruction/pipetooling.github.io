import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7989',
  date: '2026-11-19',
  title: 'Lien desk: Months on this job is one card, read top to bottom',
  kind: 'feature',
  highlights: [
    'Months on this job on a notice is one card now, in one order: the last day of work, the months, the money, then the notes. Every row shares the same edges. One line stands where the paragraph was: Tick a month to put it on this notice.',
    'The money is one block under the months. The claim is the total line, with its figure at the right edge under the ticks and the months this notice names beneath it. The bills are the lines under it, with Billed, Paid and Owed on that same edge. The figure is said once.',
    'This notice’s column is quieter: only its head and the months you tick are tinted, so a tick shows what it changed. A month whose window closed unsent keeps its red and gains a red bar at its left edge.',
    'On a phone the months no longer slide sideways. Each month sits over its window, an earlier paper shows as a mark like A ✓, and the tick stays at the right edge. Every press works as before, and nothing is saved by looking.',
  ],
}

export default note
