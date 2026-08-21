import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2046',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Roadmap Plan: per-task bars on every stage card',
  highlights: [
    'Each stage card in the Now list gets the Timeline’s per-task bar: one slot per task in task order — done green in true position, the next one up amber-ringed, the rest outlined.',
    'Hover a slot for the task’s name; tap it to open the task card. Up-next locked stages show the same bar with dashed slots.',
    'The bar always shows the whole stage, even while an assigned/unstaffed focus lens is filtering the list below it.',
  ],
}

export default note
