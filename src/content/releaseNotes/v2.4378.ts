import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4378',
  date: '2026-10-02',
  title: 'CI catches a window that closes on the press',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Every pull request now checks that windows close on a click outside, a press and a release, not on the press alone.',
    'The failure points at the line and says how to fix it: one command moves the window to the click.',
    'A window that is meant to close on the press says so with a comment above it, with the reason.',
  ],
}

export default note
