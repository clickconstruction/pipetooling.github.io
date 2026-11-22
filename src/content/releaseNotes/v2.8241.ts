import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8241',
  date: '2026-11-21',
  title: 'View as: Exit never leaves you signed in as the person',
  kind: 'fix',
  highlights: [
    'When Exit cannot put a dev’s own sign-in back, it now signs that browser out and shows the sign-in page.',
    'Before, a failed Exit could take the View as banner away while the browser was still signed in as the person.',
    'The person’s own phone and computer stay signed in. Only the dev’s browser is signed out.',
  ],
}

export default note
