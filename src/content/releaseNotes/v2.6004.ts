import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6004',
  date: '2026-10-27',
  title: 'The dev seat can file a document onto a matter’s Evidence tab',
  kind: 'feature',
  highlights: [
    'A dev working through the MCP seat can now put a PDF, an image, an email file or a plain-text note onto a Legal desk matter’s Evidence tab: a sent letter, a received notice, a mailing receipt, a scan. It is planned first and filed only when the plan is confirmed, the same way the seat writes a Timeline step.',
    'The filed document carries the same title, one-line description, day and state the office types on the Evidence tab, including the sent record (how it went out and to whom), so the firm sees it exactly as if the office had dropped it there.',
    'The file itself is stored under the matter before the row is written; a row that cannot be written removes the file again, and the file’s bytes never reach the call log.',
  ],
}

export default note
