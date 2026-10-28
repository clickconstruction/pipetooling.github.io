import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6005',
  date: '2026-10-28',
  title: 'The dev seat can answer a gap on the Legal desk’s attorney checklist',
  kind: 'feature',
  highlights: [
    'A dev working through the MCP seat can now put the one line an attorney reads instead of a gap in the Legal desk’s “Before this goes to an attorney” list: a letter that went out on paper, a call that was made, work done on a handshake. It is planned first and written only when the plan is confirmed, the same way the seat files a document.',
    'The answer lands exactly where the desk’s own Answer button puts it, under its gap, with the gap’s words and an optional Evidence document that shows it, so the office and the firm read it the same way.',
    'The seat can also take an answer back. It never opens a matter, never touches the matter’s jobs, and a closed matter refuses it.',
  ],
}

export default note
