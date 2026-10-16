import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5588',
  date: '2026-10-16',
  title: 'The deploy log shows a build’s real error',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'When the site’s build fails, the deploy log now shows the error that stopped it. Before, a missing-file message from the step that copies the 404 page replaced it, which hid the Training build break for an afternoon.',
    'Nothing changes on screen.',
  ],
}

export default note
