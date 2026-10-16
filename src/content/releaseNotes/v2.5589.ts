import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5589',
  date: '2026-10-16',
  title: 'The app builds again: the Training card reads a course’s size from its own file',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'Every build of the app since this afternoon’s Training update had failed, so nothing from today had reached clicktooling.com. The Training card counted the lesson files in a way that worked on a dev’s machine and broke the production build.',
    'The card now reads the lesson count and the hours from the course’s own file, and a test holds those numbers to the lessons on disk.',
  ],
}

export default note
