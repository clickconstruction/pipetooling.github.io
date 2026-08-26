import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2371',
  date: '2026-08-26',
  title: 'Pushed-back tasks wear their history',
  kind: 'feature',
  highlights: [
    'Move a due date later and the task remembers: a "pushed ×2" chip on Manage, an "Originally due Fri, Aug 29 — pushed ×2, +5 days so far" line in the edit window, and named entries in the task\'s activity.',
    'Escalation messages carry the same rider — a deadline can\'t be quietly managed around by nudging the date.',
    'Pulling a date earlier never earns a marker, and returning to the original clears it.',
  ],
}

export default note
