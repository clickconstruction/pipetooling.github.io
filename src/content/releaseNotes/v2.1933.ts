import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1933',
  date: '2026-08-20',
  title: 'Fix missing bill lines in one sitting',
  kind: 'feature',
  highlights: [
    'Filter Billed to "No line" and a new Fix bill lines… button opens a worklist: every billed job whose money is on no bill line, biggest dollars first.',
    'Set the date each bill actually went out and click Create line — the full open amount lands on a backdated bill line and immediately starts aging, chasing, and forecasting.',
    'Progress counts up as you work ("12 of 64 fixed"); the board refreshes when you close.',
  ],
}

export default note
