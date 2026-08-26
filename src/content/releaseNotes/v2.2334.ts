import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2334',
  date: '2026-08-26',
  title: 'The app now counts which buttons get used',
  kind: 'feature',
  highlights: [
    'Clicks on navigation — the top bar, gear menu, bottom tabs, and dashboard shortcuts — are now counted, so upcoming design decisions follow how people actually move through the app.',
    'Only the button and the page it leads to are recorded — nothing about customers, money, or what you type.',
    'Nothing changes in how the app looks or feels; this is measurement only.',
  ],
}

export default note
