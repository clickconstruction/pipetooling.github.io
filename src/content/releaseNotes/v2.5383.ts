import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5383',
  date: '2026-10-12',
  title: 'Messages: our own link to a job’s Drive file, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A link of ours to one file in a job’s Drive folder opens it: a Plans file in Drive’s viewer, a Team only file through the app.',
    'A link cut off, or older than 30 days, opens nothing.',
    'Nothing makes a link yet. The screens come next.',
  ],
}

export default note
