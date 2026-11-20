import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8036',
  date: '2026-11-20',
  title: 'View as on a phone: Exit is a thin bar across the top',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'For devs only. While you view the app as someone else on a phone, Exit is now a thin amber bar across the top of the screen. Before, it was a tall outlined button that pushed the header and the page down.',
    'The whole bar is the press, from one edge of the screen to the other. It still reads Exit and the name, such as Exit (Sample leader), and one press still returns you to your own account on the page you left.',
    'The bar is a shade darker than the amber header under it, so it is plain that you are viewing as someone else. A long name wraps onto a second line.',
    'On a computer nothing moves. The button stays in the header row.',
  ],
}

export default note
