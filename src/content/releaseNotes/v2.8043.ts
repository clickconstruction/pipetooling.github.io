import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8043',
  date: '2026-11-20',
  title: 'Gear menu: Fix Mode is now Tell the dev, and Pin Mode is now Pin bar',
  kind: 'fix',
  highlights: [
    'Two rows of the gear menu were called modes and are not. Each only shows or hides one thing, so each is now named for that thing and carries its icon.',
    'Fix Mode is now Tell the dev, with the wrench beside it. Ticked, the wrench shows. Unticked, it is hidden.',
    'Pin Mode is now Pin bar, with the pin beside it. It shows or hides the bar at the bottom of a page that pins it to your Dashboard.',
    'A grey band sits under the modes, so Mode now means a row that changes the page. Your choices are kept: a wrench you had hidden stays hidden.',
  ],
}

export default note
