import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5372',
  date: '2026-10-12',
  title: 'Messages: a place for our own links to a job’s Drive files, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The app can keep its own link to one file in a job’s Drive folder, which ends after 30 days and can be cut off.',
    'A message we send will keep how each of its files went: as the file, as our link, or as the picture.',
    'Nothing uses it yet. The link handler and the screens come next.',
  ],
}

export default note
