import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5433',
  date: '2026-10-13',
  title: 'Messages: our link to a Drive file opens only what is safe to show',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A web page, a drawing that can carry a script, or a script sent through our link is saved, never shown.',
    'A Team only file that has grown past 50 MB since its link was made opens nothing.',
    'Save to Drive pressed twice keeps the one copy.',
  ],
}

export default note
