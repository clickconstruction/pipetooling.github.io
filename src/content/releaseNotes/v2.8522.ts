import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8522',
  date: '2026-11-24',
  title: 'View as: the sign-in page says why Exit signed you out',
  kind: 'fix',
  highlights: [
    'Sometimes Exit cannot put your own sign-in back, so it signs this browser out. The sign-in page now says so in a line above the form.',
    'Before, you landed on a bare sign-in form with no reason, which read as a fault.',
    'Nothing else about Exit changed. It still signs the browser out so that nothing saves under the other person’s name.',
  ],
  roles: ['dev'],
}

export default note
