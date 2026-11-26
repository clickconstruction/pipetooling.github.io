import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8625',
  date: '2026-11-26',
  title: 'Working hours: after Take working hours off, the row keeps Earlier hours and says what it did',
  kind: 'fix',
  highlights: [
    'After Take working hours off, the Working hours row reads Not set yet and still has Earlier hours, which opens every save, the take-off last.',
    'Before, the press was gone with the hours, though the window had said the hours were kept under Earlier hours.',
    'What a save did now stays on the row for a few seconds beside its toast, so a take-off that redraws the row still says Working hours taken off.',
  ],
}

export default note
