import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3464',
  date: '2026-09-14',
  title: 'Quote compare: say why a pick differs from the schedule, and when it lands',
  kind: 'feature',
  highlights: [
    'Tap the status on any picked row of the Supply house quotes compare and say why — long lead time, discontinued, in stock, the or-equal clause, cost, or other — with a note for what the GC will ask.',
    'The same popover takes the lead time (In stock · 1 wk · 2 wk · 4+ wk, or typed) and lets you call the pick Superseded, Equal, or a Design change when the model numbers alone cannot tell.',
    'Picking a price that differs from the schedule opens it on its own; a row with no reason yet reads "why?", the counts line says how many are unreasoned, and the footer repeats it. Nothing is blocked — Mark reviewed still works.',
  ],
}

export default note
