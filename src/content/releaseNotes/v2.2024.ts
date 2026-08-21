import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2024',
  date: '2026-08-21',
  title: 'Count Sheet: edit every line in place',
  kind: 'feature',
  highlights: [
    'Every value on the Count Sheet is now editable right on the row — tap a count, fixture, or plan page, type, Enter saves, Esc reverts. Values still read like a printed sheet until you touch them.',
    'An empty plan page becomes a red dashed field you can type straight into; in By plan page, changing a page hops the row to its group live.',
    'Renaming a row to a fixture already on the bid is blocked (one fixture name, one row), and the toolbar tightened onto a single line.',
  ],
}

export default note
