import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4526',
  date: '2026-10-04',
  title: 'Lien desk Calendar: an overdue job is listed with its property',
  kind: 'feature',
  highlights: [
    'When a property has a notice or lien date still ahead, its overdue jobs are now listed under that property, greyed, with the amount marked still owed. One property reads in one place.',
    'Inside a GC’s group, those jobs sit under the property’s address, after the jobs that are still on the clock.',
    'The counts and the dollars do not change. Overdue still counts every overdue job, and its bar says how many are listed with their property. A GC’s total is still its notices only.',
    'Press the Overdue pill to see every overdue job in one list, as before.',
  ],
}

export default note
