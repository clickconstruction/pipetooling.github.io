import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4033',
  date: '2026-09-28',
  title: 'My Time day editor: a new session right beside another one saves',
  kind: 'fix',
  highlights: [
    'A session added with + Add session that ends exactly where another starts (or starts where one ends) joins that session’s block. Saving that block failed — with a message about splitting a draft, or with a database error.',
    'Now the new session is saved and the one beside it keeps its note.',
    'Splitting or merging the new session with its neighbour before the first save gets a plain message: undo that change and Save, then edit again.',
  ],
}

export default note
