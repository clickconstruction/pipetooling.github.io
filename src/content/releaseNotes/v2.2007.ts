import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2007',
  date: '2026-08-21',
  title: 'Ledger notes: click to place, live draft preview',
  kind: 'feature',
  highlights: [
    'With the note composer open, click any ledger row to place your note above that date — no more typing the date by hand (dragging still works too).',
    'A dashed "draft" row shows your note right in the ledger as you type, exactly where it will land, and moves the moment you pick a different date.',
    'Nothing is saved until you hit Save — the draft row is just a preview.',
  ],
}

export default note
