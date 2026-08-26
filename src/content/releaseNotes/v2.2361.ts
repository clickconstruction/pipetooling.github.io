import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2361',
  date: '2026-08-26',
  title: 'Drag a Timeline bar to size the task',
  kind: 'feature',
  highlights: [
    'On the roadmap Timeline, expand a stage and drag any open task\'s right edge — the bar widens with a live "2d → 4.5d" readout, snaps to half-days, and the 🎯 forecast re-derives while you pull.',
    'Release saves the estimate (same value as the task card\'s ⏱ stepper); Esc cancels. Desktop pointers only — phones keep the stepper.',
  ],
}

export default note
