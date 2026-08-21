import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2001',
  date: '2026-08-21',
  kind: 'feature',
  title: 'Portal modal: live preview, gear menu, red globe, link history',
  highlights: [
    'The globe modal now shows a live scaled-down preview of the exact page the customer opens — it follows the As customer / As GC toggle.',
    'Rotate and Turn off moved under a gear (Advanced), with a history of when each link was created, rotated, or turned off and by whom.',
    'A turned-off portal paints the globe red everywhere, and opening the modal no longer silently re-creates a link that was deliberately turned off — turning it back on is an explicit button.',
  ],
}

export default note
