import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2238',
  date: '2026-08-24',
  title: 'Payroll opens on open reports',
  kind: 'feature',
  highlights: [
    'People → Payroll now opens showing just the open (unpaid and partial) pay reports — fully paid history no longer buries what still needs attention.',
    'The old Hide paid button is now an Open | Paid | All switch with counts, so paid reports are one click away instead of mixed in.',
    'A note under the table says how many reports the current view hides, with a show-all link — nothing is ever silently missing.',
  ],
}

export default note
