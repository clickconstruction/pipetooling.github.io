import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2927',
  date: '2026-09-06',
  title: 'Jobs → Subs: Work Orders and Sub Labor become one tab, and stages get a window',
  kind: 'feature',
  highlights: [
    'Jobs → Work Orders and Jobs → Sub Labor are one tab now: Subs, with a Work / Pay switch. Work is the agreements board grouped by job; Pay is the pay run, unchanged. Old links and dashboard pins still land where they did.',
    'A job\'s line items can be read as stages. "+ Add a stage…" on a job header picks a line item and a window (the span you want it done in); the stage sits as its own row until a work order fulfils it, then it rides under that order\'s sheet row with a Window column beside it.',
    'The work-order assembler picks a stage: its window prefills the work window and its line-item amount the price, and the signed order remembers which stage it fulfils. "Set a window…" on an existing sheet row links its order the same way.',
    'A new tile, Stages waiting, counts windows with no work order yet. Superintendents open Subs and see Pay, exactly what Sub Labor showed them.',
  ],
}

export default note
