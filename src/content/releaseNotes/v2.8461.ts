import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8461',
  date: '2026-11-24',
  title: 'The row at the top shows for five seconds, then slides away',
  kind: 'feature',
  highlights: [
    'On a phone, the row with Task Mode, Dashboard and Job Mode now shows for five seconds each time you go to the Dashboard. A thin grey line under it gets shorter as the time runs out, then the row slides up and away.',
    'The row lies over the top of the page, so nothing under it moves when it comes or goes. On an iPhone it starts under the bar that holds the clock and the camera, and slides away behind it.',
    'Rest a finger on the row and it waits. Tap a part and the row stays five more seconds. Swipe up on it to send it away at once.',
    'A small grey bar marks the row’s place. Tap it, or pull the page down from its top, to bring the row back. In Task Mode the row stays in sight, since it is the way out.',
  ],
}

export default note
