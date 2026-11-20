import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7988',
  date: '2026-11-19',
  title: 'Document builder: a place in the database for a builder’s contents',
  kind: 'feature',
  highlights: [
    'A builder’s contents now have a place in the database: a draft, a published copy, and a revision number.',
    'A published copy changes only with a new revision, so a revision number always names one set of words.',
    'The app can keep who read which revision. A new revision is unread again until someone marks it.',
    'Nothing on screen changes yet. Only a dev reads or changes a builder.',
  ],
}

export default note
