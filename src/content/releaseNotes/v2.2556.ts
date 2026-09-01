import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2556',
  date: '2026-08-31',
  title: 'Excuse a late, and write-ups start from the facts',
  kind: 'feature',
  highlights: [
    'Late rows in People → Writeups now take an "Add note" — excuse a late ("dentist, told office 7:40") and the row dims, drops out of the pattern counts, and shows who excused it. The clock record itself never changes.',
    'The attendance summary shows excused days honestly: "Late 4× (2 excused)".',
    '"Start a tardiness write-up" now opens the editor with the person already selected and a From-clock-records strip listing their recent lates — no retyping the evidence. Name a write-up template with "Tardiness" and it will be preselected too.',
  ],
}

export default note
