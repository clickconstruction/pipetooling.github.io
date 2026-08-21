import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2028',
  date: '2026-08-21',
  title: 'Count Sheet: merge-on-rename and drag reorder',
  kind: 'feature',
  highlights: [
    'Renaming a row to a fixture already on the bid now offers to merge — the counts combine onto the existing row ("2 + 3 → 5") instead of just refusing.',
    'Rows reorder by drag right on the Count Sheet (List mode) — the same order the Old view and exports use. Nothing is left that still needs the Old view.',
  ],
}

export default note
