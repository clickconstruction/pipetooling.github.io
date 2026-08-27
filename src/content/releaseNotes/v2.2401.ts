import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2401',
  date: '2026-08-27',
  title: 'The margin brush: sweep rows to price them',
  kind: 'feature',
  highlights: [
    'A 🖌 Margin › button now sits left of Solve › on the Workbench. Pick it up, load a margin, and your cursor becomes a paintbrush — press and sweep across rows, and every row the brush crosses prices at that margin instantly.',
    'Held 📌, fixed-price, and no-cost rows are never painted. Let go and the sweep saves in one batch; ↩ Undo sweep takes the whole stroke back, and Esc puts the brush down.',
    'The Workbench\'s Apply-margin column is retired — the brush is faster for one row and much faster for twenty.',
  ],
}

export default note
