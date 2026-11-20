import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7988',
  date: '2026-11-19',
  title: 'Document builder: a place in the database for builders, sheets, links and sends',
  kind: 'feature',
  highlights: [
    'A builder’s contents now have a place in the database: a draft, a published copy, and a revision number.',
    'A published copy changes only with a new revision. The app can keep who read which revision.',
    'A job’s sheet, its link and each send have a place too. A link keeps only a scrambled form of its code.',
    'Nothing on screen changes yet. Only a dev reads or changes any of it.',
  ],
}

export default note
