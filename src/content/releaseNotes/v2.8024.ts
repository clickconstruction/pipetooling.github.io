import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8024',
  date: '2026-11-19',
  title: 'Document builder: type on the Sub NDA as a GC sees it, and publish a revision',
  kind: 'feature',
  highlights: [
    'Every piece of words on the Sub NDA’s flow is now a field. Press the words and type. The draft saves by itself.',
    'A map beside it has a row a topic and a column a level. Press a cell to open that page at that level.',
    'The pages changed since the published revision are listed, each with a way back. Publish makes the next revision.',
    'A published revision can be marked as read by an attorney. No clause wording is typed here: a clause stays grey bars.',
  ],
}

export default note
