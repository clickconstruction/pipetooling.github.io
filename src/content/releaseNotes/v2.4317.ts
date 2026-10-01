import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4317',
  date: '2026-10-01',
  title: 'GC Review: lien waiver chips read like the Bill tab',
  kind: 'feature',
  highlights: [
    'A bill with no waiver started reads grey in GC Review, as it does on the Bill tab.',
    'Amber now means one thing everywhere: a waiver you started needs its next step.',
    'Clicking a chip still opens the job, where Add waiver is one press away.',
  ],
}

export default note
