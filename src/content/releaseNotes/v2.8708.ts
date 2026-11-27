import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8708',
  date: '2026-11-27',
  title: 'The sign-in page’s two buttons fit a thumb on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, Sign in and Continue with Google each stood about 41 px tall.',
    'Both now stand 44 px tall on a phone, the size of a fingertip.',
    'At a desk the page is unchanged.',
  ],
}

export default note
