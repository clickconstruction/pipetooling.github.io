import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2272',
  date: '2026-08-25',
  title: 'A missed task is one task, not one row per day',
  kind: 'fix',
  highlights: [
    'The Missed view showed a separate row for every day a repeating task went undone — a daily task missed for months meant hundreds of rows and counts like "505 outstanding".',
    'Now each task shows once: the red chip says how long it has waited, and a grey "missed ×N" chip says how many days it was missed. Counts show real tasks, not copies.',
    'The ✓ resolves the whole backlog at once (one completion, one notification), and the trash clears every missed copy after a confirm that tells you the count.',
  ],
}

export default note
