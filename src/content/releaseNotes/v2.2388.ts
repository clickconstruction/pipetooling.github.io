import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2388',
  date: '2026-08-27',
  title: 'Solver: "or total" and Solve are one piece',
  kind: 'feature',
  highlights: [
    'Solve sits snug against the target-total field now, and "or total · $ · Solve ▾" moves to the next line as one piece when the solver ring wraps — no more Solve stranded away from the field it fires.',
  ],
}

export default note
