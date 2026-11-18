import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7782',
  date: '2026-11-18',
  title: 'View as on a phone: the Exit button has its own line above the header',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'For devs only. While you view the app as someone else on a phone, the amber Exit button now sits on its own line above the header.',
    'The button shows its whole name, such as Exit (Sample leader). Before, the name was cut off and the button ran past the edge of the screen. A long name wraps onto a second line.',
    'The header under it holds the same icons in the same places as it does for that person. One press still returns you to your own account, on the page you left.',
    'On a computer nothing moves. The button stays in the header row.',
  ],
}

export default note
