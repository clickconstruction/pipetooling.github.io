import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6421',
  date: '2026-11-02',
  title: 'The Bridge fits on a phone',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'On a phone, The Bridge was wider than the screen, so the whole page slid sideways. Settings → What everyone sees had flagged it since v2.6137.',
    'The pace dial squeezed its slider to nothing and ran its twelve-week line off the right edge. The slider now takes the whole row, with the number and the line under it.',
    'Four panels (Everything else waits, Last week\'s call, This week, Fix the reading) were held at 380 px. They now shrink to the screen.',
    'In Fix the reading, a long amber chip hid the words beside it and pushed its link off the screen. The words and the link now drop under the chip.',
  ],
}

export default note
