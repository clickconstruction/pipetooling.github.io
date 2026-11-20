import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8005',
  date: '2026-11-19',
  title: 'Document builder: a builder’s contents are kept in the database',
  kind: 'feature',
  highlights: [
    'A builder’s words are now kept in the database, as a draft. They were a file inside the app.',
    'A builder with no words yet shows Load the first draft. That press writes placeholder words for you to change.',
    'A builder’s row says where it stands: not loaded, a draft, or published on a revision, and who read it.',
    'Nothing reaches anyone outside. Only a dev sees the tab.',
  ],
}

export default note
