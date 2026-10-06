import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4609',
  date: '2026-10-05',
  title: 'Submittals: a schedule typed later grades the takeoff rows',
  kind: 'feature',
  highlights: [
    'Rows built from the takeoff read Proposed. When the plans’ schedule comes in after, step 2 offers "Grade N rows against the schedule…".',
    'The window lists each Proposed row the schedule names, what the plans say, and the status it will take: As specified or Alternate.',
    'Grade writes the plans’ product and the status onto each row. Parts, houses, lead times, reasons and cut sheets stay as they are. A row the schedule does not name stays Proposed.',
  ],
}

export default note
