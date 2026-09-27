import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3874',
  date: '2026-09-26',
  title: 'Pay reports: one assembly for generate, view and print',
  kind: 'fix',
  highlights: [
    'The pay report gathered its crew lines, vehicles, housing, offsets, deductions and additional lines three times over — once each for generating, viewing and printing. It is one fetch now, and Print is the View document sent to the print dialog.',
    'The payroll math behind Net Pay and the per-day job / bid lines has tests.',
    'Nothing on screen changes.',
  ],
}

export default note
