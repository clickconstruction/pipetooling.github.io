import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8497',
  date: '2026-11-24',
  title: 'The row at the top opens the app, then shrinks into the gear',
  kind: 'feature',
  highlights: [
    'On a phone, the row with Task Mode, Dashboard and Job Mode is now the first thing you see when the app opens. It shows for five seconds, then shrinks into the gear at the top right, and the gear lights up for a moment.',
    'A tap on any part closes the row the same way, at once. The small grey bar that marked the row’s place is gone, so the top of the page is as tall as it was before the row.',
    'From then on you switch in the gear menu, which now lists Dashboard, Job Mode and Task Mode on a phone too. Show full dashboard is back under the Job Mode card on a phone.',
    'To stop the row from showing, untick Modes at open in the gear menu. The choice is kept on that phone.',
  ],
}

export default note
