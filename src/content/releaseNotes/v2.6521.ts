import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6521',
  date: '2026-11-04',
  title: 'The who-has-it pill names the holder, you included',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Messages and in a thread’s header the pill reads “Robert has this” for everyone, including Robert. It no longer says “You have this” to the person who holds it.',
    'A screenshot or a shared screen now says who holds the conversation without knowing who was signed in.',
  ],
}

export default note
