import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2204',
  date: '2026-08-23',
  title: 'Pricing Workbench: cleaner strip, typeable margin',
  kind: 'fix',
  highlights: [
    'All the price options now sit together in one light gray tray, and the margin can be typed directly (Enter to solve) as well as slid.',
    'The target-total box starts the size of its number and grows as you type; Apply and Discard appear on their own line only while a preview is waiting, and leave when you save.',
  ],
}

export default note
