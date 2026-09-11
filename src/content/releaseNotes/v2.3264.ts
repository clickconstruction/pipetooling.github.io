import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3264',
  date: '2026-09-11',
  title: 'People → Overhead: click any dollar in Who makes up overhead to see what adds up to it',
  kind: 'feature',
  highlights: [
    'Every dollar cell in the table opens the sessions or purchases behind it: day, clock-in and clock-out, hours, the wage used, and the amount, grouped by week with subtotals — or, for a purchase cell, each purchase with its source and accounting section. The Pool row opens the whole column grouped by person.',
    'The header proves the number (hours × average rate) and the footer says whether the lines tie to the cell. Pills move between a person’s columns without closing.',
    'Sessions awaiting approval, sessions with no wage on file, and sessions over ten hours are chipped on their line and counted up top, each with a link to where the fix lives. Largest first brings outliers up; a filter finds a note, bid, or merchant; Copy as CSV takes the lines to a spreadsheet.',
  ],
}

export default note
