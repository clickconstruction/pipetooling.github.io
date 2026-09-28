import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3961',
  date: '2026-09-27',
  title: 'GC statements: choose who gets the GC’s replies',
  kind: 'feature',
  highlights: [
    'Draft Message has a new line, Replies go to. When the GC has an account man he is already picked: the GC’s reply reaches him, and you are copied on the statement. Pick Me to take the replies yourself.',
    'After sending, the message says where replies went.',
    'In the bill checklist, the buttons now read Check only and Check & send… — the second signs off and opens the statement draft in one step.',
    'A scheduled send still replies to whoever scheduled it.',
  ],
}

export default note
