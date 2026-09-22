import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3712',
  date: '2026-09-22',
  title: 'Day book: the month as a rhythm',
  kind: 'feature',
  highlights: [
    'People → Day book has a Month view: one row per kind of work (Billing, Deposits, Contracts, Approvals), one column per day, and in each cell the initials of who did it. It reads coverage and gaps, never volume.',
    'A day nobody clocked in shows as a grey dot and neither breaks nor extends a run. Today is outlined. Tap any cell to open that day.',
    'Three working days in a row with nothing on a row, while that kind of work was waiting, will turn amber. The app cannot yet say what was waiting on a past day, so for now nothing is amber and an empty run is just empty.',
    'The address bar carries the view, so a link can open one person’s month.',
  ],
}

export default note
