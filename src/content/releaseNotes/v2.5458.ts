import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5458',
  date: '2026-10-13',
  title: 'Messages: photos that come in go to the job’s photos in Drive',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Save to Drive puts a photo in the job’s Photos folder, named by its day, who sent it and a caption.',
    'A Pipeline job’s photos go to its Customer Pictures folder when that link is a Drive folder.',
    'On a job set to save every photo, the app copies each new one to Drive by itself, a few minutes after it comes in.',
    'The setting has no switch on screen yet.',
  ],
}

export default note
