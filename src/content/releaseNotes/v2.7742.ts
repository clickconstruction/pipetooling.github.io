import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7742',
  date: '2026-11-18',
  title: 'Tell the dev: a note always carries the app’s version',
  kind: 'fix',
  highlights: [
    'A note sent the moment the box opens now carries the app’s version too. Before, a quick note could go without it.',
    'The box lists the version as soon as it opens, with nothing to load.',
    'A phone still running an older copy of the app names its own version, which tells the dev it needs the update.',
  ],
}

export default note
