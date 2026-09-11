import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3326',
  date: '2026-09-11',
  title: 'Test report: the Send button stays in the bottom bar',
  kind: 'fix',
  highlights: [
    'Opening Send to GC… put the real Send button at the bottom of the send sheet, below the message, while the bar at the bottom of the window showed a greyed-out button that did nothing — so a resend looked stuck. The bar\'s button is now the Send button itself (it wakes up when the sheet is complete), and the sheet scrolls into view when it opens.',
    'Email subjects no longer read "Gas Test Test Report" or "Pinpoint Test Test Report".',
  ],
}

export default note
