import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6007',
  date: '2026-10-28',
  title: 'The Review asked step finishes on the app’s own text, and a job already answered is never asked again',
  kind: 'fix',
  highlights: [
    'The residential flow’s Review asked step now turns done once the app’s own review text goes out, read by the rating link it carries, so the morning run stops offering or sending the ask again every day.',
    'A review offer on Today’s sends for a job the customer already answered is held with why, Send all skips it, and a press on it makes no fresh ask. The morning run keeps such an offer back the same way it keeps a text back.',
    'A residential customer’s reminder the app sends itself is now filed on the Pipeline job, as the office’s presses are, so the thread, the step card and the next morning’s run all see it.',
  ],
}

export default note
