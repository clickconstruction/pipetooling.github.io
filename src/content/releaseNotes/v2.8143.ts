import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8143',
  date: '2026-11-20',
  title: 'Document builder: a draft has a number in the database',
  kind: 'fix',
  highlights: [
    'Each builder and each job’s sheet now keeps a number that goes up every time its draft changes or it is published.',
    'It is the ground for refusing a save from a tab left open, which comes next. Nothing on screen changes yet.',
  ],
}

export default note
