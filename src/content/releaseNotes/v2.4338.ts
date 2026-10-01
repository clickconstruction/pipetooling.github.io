import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4338',
  date: '2026-10-01',
  title: 'Windows stay open when a drag ends outside them',
  kind: 'fix',
  highlights: [
    'A window now closes on a click outside it only when you both press and let go outside it. A drag that starts inside and ends outside no longer closes it. That covers a signature drawn off the edge of the pad and text selected in a box.',
    'A click outside the signing pad closes the pad only, and the Release of Lien window behind it stays open. On a bid’s Submittals, a click outside When can a row split? closes that window only, not Choose from the takeoff.',
    'Choose from the takeoff and When can a row split? used to close the moment you pressed outside them. Now they wait for you to let go, like the other windows.',
    'The ✕, Close, Cancel and the Escape key work as before.',
  ],
}

export default note
