import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2148',
  date: '2026-08-23',
  title: 'Pricing Workbench: a one-line solver bar',
  kind: 'fix',
  highlights: [
    'The solver box is one compact line — Solver · Margin slider · or total $ + Solve · Price unpriced only — that wraps cleanly on narrow screens instead of four stacked columns with long uppercase labels.',
    'The "round up to $5" checkbox is gone; solved prices still round up to $5 (it was on by default).',
    'After a target solve the echo reads "→ previewing $280,185.04 (rounded)" right beside Solve; the no-cost note lives only in the amber banner.',
  ],
}

export default note
